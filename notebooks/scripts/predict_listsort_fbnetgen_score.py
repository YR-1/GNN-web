#!/usr/bin/env python
"""
Complete score-only FBNetGen predictor in one file.

What this file contains:
- Time-series -> LDW graph-window conversion
- Basic FBNetGenFromGraph architecture
- Enhanced FBNetGenFromGraphEnhanced architecture
- Checkpoint auto-detection
- Window prediction + subject-level averaging

External packages still required:
  torch, torch_geometric, numpy, scikit-learn

Examples:
  python predict_fbnetgen_score.py --timeseries_path uploaded_timeseries.txt

  python predict_fbnetgen_score.py ^
    --timeseries_path uploaded_timeseries.csv ^
    --checkpoint results/advanced/fbnetgen_v5_full/graphs_outer5_inner5/fbnetgen_best.pt ^
    --json

  python predict_fbnetgen_score.py --graph_path converted_graph_windows.pt
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.covariance import ledoit_wolf
from torch_geometric.data import Data
from torch_geometric.loader import DataLoader
from torch_geometric.nn import GATv2Conv, global_add_pool, global_mean_pool


ROOT = Path(__file__).resolve().parent
DEFAULT_CHECKPOINT = (
    ROOT
    / "results"
    / "advanced"
    / "fbnetgen_v5_full"
    / "graphs_outer5_inner5"
    / "fbnetgen_best.pt"
)


# ---------------------------------------------------------------------------
# Preprocessing: uploaded time-series -> graph windows
# ---------------------------------------------------------------------------


def load_single_timeseries(path: Path, expected_nrois: int) -> np.ndarray:
    """Load one [time, ROI] .txt/.csv file and fix [ROI, time] orientation if clear."""
    if path.suffix.lower() == ".csv":
        ts = np.loadtxt(path, delimiter=",")
    else:
        ts = np.loadtxt(path)

    if ts.ndim == 1:
        ts = ts[:, np.newaxis]

    if ts.shape[0] == expected_nrois and ts.shape[1] != expected_nrois:
        ts = ts.T

    if ts.shape[1] != expected_nrois:
        raise ValueError(
            f"Expected {expected_nrois} ROI columns, got shape {ts.shape}. "
            "Provide a file shaped [time_points, n_rois]."
        )

    return ts.astype(np.float32, copy=False)


def cov2corr(covariance: np.ndarray) -> np.ndarray:
    v = np.sqrt(np.diag(covariance))
    outer_v = np.outer(v, v)
    with np.errstate(divide="ignore", invalid="ignore"):
        corr = covariance / outer_v
    corr[~np.isfinite(corr)] = 0
    corr[covariance == 0] = 0
    return corr


def threshold_proportional(W: np.ndarray, p: float, copy: bool = True) -> np.ndarray:
    """Keep the strongest proportion p of edges, matching the training preprocessing."""
    if not 0 < p < 1:
        raise ValueError("Proportion p must be between 0 and 1.")
    if copy:
        W = W.copy()

    n = len(W)
    np.fill_diagonal(W, 0)

    if np.all(W == W.T):
        W[np.tril_indices(n)] = 0
        ud = 2
    else:
        ud = 1

    ind = np.where(W)
    order = np.argsort(W[ind])[::-1]
    keep = round((n * n - n) * p / ud)
    W[(ind[0][order][keep:], ind[1][order][keep:])] = 0

    if ud == 2:
        W[:, :] = W + W.T

    W[W > 0.9999] = 1
    return W


def extract_ldw_corr(
    timeseries_list: list[np.ndarray],
    wsize: int,
    shift: int,
    threshold: float = 0.40,
) -> tuple[list[list[np.ndarray]], list[list[np.ndarray]], list[int]]:
    """Compute LDW correlation node features and thresholded adjacency per window."""
    overlap = wsize - shift
    if overlap < 0:
        raise ValueError("shift must be <= wsize.")

    nwin = [int((ts.shape[0] - overlap) / (wsize - overlap)) for ts in timeseries_list]
    node_feats: list[list[np.ndarray]] = []
    adj_mats: list[list[np.ndarray]] = []

    for subj_idx, ts in enumerate(timeseries_list):
        if nwin[subj_idx] < 1:
            raise ValueError(
                f"Subject {subj_idx} produced no windows. "
                f"Need at least {wsize} time points."
            )

        corr_subject = []
        adj_subject = []

        for wi in range(nwin[subj_idx]):
            st = wi * shift
            en = st + wsize
            window = ts[st:en, :]

            cov, _ = ledoit_wolf(window, assume_centered=False)
            corr_signed = cov2corr(cov)
            corr_abs = np.abs(corr_signed)

            adj = threshold_proportional(corr_abs, threshold)
            np.fill_diagonal(adj, 1)

            corr_subject.append(corr_signed.astype(np.float32, copy=False))
            adj_subject.append(adj.astype(np.float32, copy=False))

        node_feats.append(corr_subject)
        adj_mats.append(adj_subject)

    return node_feats, adj_mats, nwin


def pad_graph_seq(data: list[list[np.ndarray]]) -> tuple[torch.Tensor, torch.LongTensor]:
    sequences = [torch.tensor(np.asarray(seq), dtype=torch.float32) for seq in data]
    seqlengths = torch.LongTensor([len(seq) for seq in sequences])
    padded = nn.utils.rnn.pad_sequence(sequences, batch_first=True)
    return padded, seqlengths


def convert_to_graphs(
    corr: torch.Tensor,
    adj: torch.Tensor,
    seqlen: torch.LongTensor,
    scores: np.ndarray,
) -> list[Data]:
    """Convert padded correlation/adjacency tensors into non-padding PyG Data windows."""
    graphs: list[Data] = []
    n_sub = int(corr.shape[0])
    n_win = int(corr.shape[1])

    for subj_idx in range(n_sub):
        for win_idx in range(n_win):
            graph_adj = adj[subj_idx, win_idx]
            padding = bool(torch.sum(graph_adj) == 0)
            if padding:
                continue

            node_feat = corr[subj_idx, win_idx].float()
            edge_pos = torch.nonzero(graph_adj)
            edge_index = edge_pos.T.long()
            edge_attr = graph_adj[edge_pos[:, 0], edge_pos[:, 1]].unsqueeze(-1).float()

            graph = Data(
                x=node_feat,
                edge_index=edge_index,
                edge_attr=edge_attr,
                adj=graph_adj.float(),
                y=torch.tensor(float(scores[subj_idx]), dtype=torch.float32),
                num_nodes=int(node_feat.shape[0]),
                num_node_features=int(node_feat.shape[1]),
                pad=torch.tensor(False),
                last=torch.tensor(win_idx + 1 == int(seqlen[subj_idx])),
                subject_id=torch.tensor([subj_idx], dtype=torch.long),
            )
            graphs.append(graph)

    return graphs


def timeseries_to_graphs(
    timeseries_path: Path,
    expected_nrois: int = 268,
    wsize: int = 20,
    shift: int = 10,
) -> list[Data]:
    ts = load_single_timeseries(timeseries_path, expected_nrois)
    node_feats, adj_mats, _ = extract_ldw_corr([ts], wsize=wsize, shift=shift)
    corr_padded, seqlen = pad_graph_seq(node_feats)
    adj_padded, _ = pad_graph_seq(adj_mats)
    return convert_to_graphs(corr_padded, adj_padded, seqlen, np.asarray([0.0]))


def flatten_non_padding(graphs_2d: Any) -> list[Data]:
    flat = []
    for row in graphs_2d:
        for graph in row:
            if hasattr(graph, "pad") and bool(graph.pad):
                continue
            flat.append(graph)
    return flat


def load_graph_payload(graph_path: Path) -> list[Data]:
    payload = torch.load(graph_path, map_location="cpu", weights_only=False)

    if isinstance(payload, dict):
        if "graphs_flat" in payload:
            graphs = list(payload["graphs_flat"])
        elif "graphs_2d" in payload:
            graphs = flatten_non_padding(payload["graphs_2d"])
        else:
            raise KeyError("Graph payload must contain 'graphs_flat' or 'graphs_2d'.")
    elif isinstance(payload, (list, tuple)):
        graphs = list(payload)
    else:
        raise TypeError(f"Unsupported graph payload type: {type(payload).__name__}")

    if not graphs:
        raise ValueError("No graph windows found in graph payload.")

    for graph in graphs:
        if not hasattr(graph, "subject_id"):
            graph.subject_id = torch.tensor([0], dtype=torch.long)

    return graphs


# ---------------------------------------------------------------------------
# Basic FBNetGenFromGraph architecture
# ---------------------------------------------------------------------------


class GNNPredictor(nn.Module):
    def __init__(
        self,
        in_dim: int = 64,
        hidden_dim: int = 128,
        out_dim: int = 1,
        n_layers: int = 3,
        heads: int = 4,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.input_proj = nn.Linear(in_dim, hidden_dim)
        self.gat_layers = nn.ModuleList()
        self.norms = nn.ModuleList()

        for _ in range(n_layers):
            self.gat_layers.append(
                GATv2Conv(
                    hidden_dim,
                    hidden_dim // heads,
                    heads=heads,
                    dropout=dropout,
                    concat=True,
                    edge_dim=1,
                )
            )
            self.norms.append(nn.LayerNorm(hidden_dim))

        self.pool_gate = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
        )
        self.mlp = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, out_dim),
        )

    def forward(self, node_features, edge_index, edge_weight, batch):
        x = self.input_proj(node_features)
        edge_attr = None
        if edge_weight is not None:
            edge_attr = edge_weight.unsqueeze(-1) if edge_weight.dim() == 1 else edge_weight

        for i, (gat, norm) in enumerate(zip(self.gat_layers, self.norms)):
            x_res = x
            x = gat(x, edge_index, edge_attr=edge_attr)
            x = norm(F.elu(x))
            if i > 0:
                x = x + x_res

        with torch.amp.autocast("cuda", enabled=False):
            x = x.float()
            x_mean = global_mean_pool(x, batch)

            gate = self.pool_gate(x)
            batch_size = int(batch.max().item()) + 1
            x_attn = torch.zeros(batch_size, x.size(1), device=x.device, dtype=torch.float32)
            for i in range(batch_size):
                mask = batch == i
                weights = torch.softmax(gate[mask], dim=0)
                x_attn[i] = (x[mask] * weights).sum(dim=0)

            out = self.mlp(torch.cat([x_mean, x_attn], dim=-1))
        return out.squeeze(-1)


class FBNetGenFromGraph(nn.Module):
    def __init__(
        self,
        in_dim: int = 268,
        hidden_dim: int = 128,
        n_layers: int = 3,
        n_heads: int = 4,
        dropout: float = 0.3,
        refine_graph: bool = True,
    ):
        super().__init__()
        self.refine_graph = refine_graph
        self.node_encoder = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        if refine_graph:
            self.W_q = nn.Linear(hidden_dim, hidden_dim // 2)
            self.W_k = nn.Linear(hidden_dim, hidden_dim // 2)
            self.edge_scorer = nn.Linear(hidden_dim // 2, 1)

        self.predictor = GNNPredictor(
            in_dim=hidden_dim,
            hidden_dim=hidden_dim,
            out_dim=1,
            n_layers=n_layers,
            heads=n_heads,
            dropout=dropout,
        )

    def forward(self, data):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        edge_attr = data.edge_attr if hasattr(data, "edge_attr") else None
        x = self.node_encoder(x)

        if self.refine_graph and edge_index.size(1) > 0:
            src, dst = edge_index[0], edge_index[1]
            q = self.W_q(x[src])
            k = self.W_k(x[dst])
            attn_score = torch.sigmoid(self.edge_scorer(q * k))
            edge_weight = edge_attr * attn_score if edge_attr is not None else attn_score
        else:
            edge_weight = edge_attr

        return self.predictor(x, edge_index, edge_weight, batch)


# ---------------------------------------------------------------------------
# Enhanced FBNetGenFromGraph architecture
# ---------------------------------------------------------------------------


class PairNorm(nn.Module):
    def __init__(self, scale: float = 1.0):
        super().__init__()
        self.scale = scale

    def forward(self, x):
        mean = x.mean(dim=0, keepdim=True)
        x_centered = x - mean
        l2_norm = torch.norm(x_centered, p=2, dim=1, keepdim=True) + 1e-6
        return x_centered / l2_norm * self.scale * math.sqrt(x.size(0))


class EnhancedGNNPredictor(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden_dim: int,
        n_layers: int = 3,
        n_heads: int = 4,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.n_layers = n_layers
        self.input_proj = nn.Linear(in_dim, hidden_dim)
        self.gat_layers = nn.ModuleList(
            [
                GATv2Conv(
                    hidden_dim,
                    hidden_dim // n_heads,
                    heads=n_heads,
                    dropout=dropout,
                    concat=True,
                    edge_dim=1,
                )
                for _ in range(n_layers)
            ]
        )
        self.pairnorms = nn.ModuleList([PairNorm() for _ in range(n_layers)])
        self.layer_norms = nn.ModuleList([nn.LayerNorm(hidden_dim) for _ in range(n_layers)])
        self.dropouts = nn.ModuleList([nn.Dropout(dropout) for _ in range(n_layers)])
        self.residual_projs = nn.ModuleList(
            [nn.Linear(hidden_dim, hidden_dim) if i > 0 else nn.Identity() for i in range(n_layers)]
        )

    def forward(self, x, edge_index, edge_weight=None):
        x = self.input_proj(x)

        for i, (gat, pairnorm, ln, dropout, residual_proj) in enumerate(
            zip(self.gat_layers, self.pairnorms, self.layer_norms, self.dropouts, self.residual_projs)
        ):
            identity = residual_proj(x)
            edge_attr = None
            if edge_weight is not None:
                edge_attr = edge_weight.unsqueeze(-1) if edge_weight.dim() == 1 else edge_weight

            x = gat(x, edge_index, edge_attr=edge_attr)
            x = pairnorm(x)
            x = dropout(x)
            x = x + identity
            x = ln(x)
            if i < self.n_layers - 1:
                x = F.relu(x)

        return x


class FBNetGenFromGraphEnhanced(nn.Module):
    def __init__(
        self,
        in_dim: int = 268,
        hidden_dim: int = 128,
        n_gnn_layers: int = 3,
        n_heads: int = 4,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )
        self.W_q = nn.Linear(hidden_dim, hidden_dim // 2)
        self.W_k = nn.Linear(hidden_dim, hidden_dim // 2)
        self.edge_scorer = nn.Linear(hidden_dim // 2, 1)
        self.gnn_predictor = EnhancedGNNPredictor(
            hidden_dim,
            hidden_dim,
            n_layers=n_gnn_layers,
            n_heads=n_heads,
            dropout=dropout,
        )
        self.pool_gate = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1),
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, data, return_losses: bool = False):
        x = self.encoder(data.x)
        edge_index = data.edge_index
        edge_attr = data.edge_attr if hasattr(data, "edge_attr") else None
        batch = data.batch

        if edge_index.size(1) > 0:
            src, dst = edge_index[0], edge_index[1]
            q = self.W_q(x[src])
            k = self.W_k(x[dst])
            attn_score = torch.sigmoid(self.edge_scorer(q * k))
            if edge_attr is not None:
                ea = edge_attr if edge_attr.dim() == 2 else edge_attr.unsqueeze(-1)
                edge_weight = ea * attn_score
            else:
                edge_weight = attn_score
        else:
            edge_weight = edge_attr

        x = self.gnn_predictor(x, edge_index, edge_weight)

        with torch.amp.autocast("cuda", enabled=False):
            x = x.float()
            x_mean = global_mean_pool(x, batch)

            gate_scores = self.pool_gate(x)
            batch_size = int(batch.max().item()) + 1
            x_attn = torch.zeros(batch_size, x.size(1), device=x.device, dtype=torch.float32)
            for i in range(batch_size):
                mask = batch == i
                weights = torch.softmax(gate_scores[mask], dim=0)
                x_attn[i] = (x[mask] * weights).sum(dim=0)

            out = self.head(torch.cat([x_mean, x_attn], dim=-1)).squeeze(-1)

        if return_losses:
            return out, {}
        return out


# ---------------------------------------------------------------------------
# Checkpoint loading and prediction
# ---------------------------------------------------------------------------


def is_enhanced_state_dict(state_dict: dict[str, torch.Tensor]) -> bool:
    return any(
        key.startswith("encoder.")
        or key.startswith("gnn_predictor.")
        or key.startswith("head.")
        for key in state_dict
    )


def build_model(checkpoint_path: Path, in_dim: int, device: torch.device):
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    config = checkpoint.get("config", {})

    if is_enhanced_state_dict(state_dict):
        model = FBNetGenFromGraphEnhanced(
            in_dim=in_dim,
            hidden_dim=int(config.get("hidden_dim", 128)),
            n_gnn_layers=int(config.get("n_gnn_layers", config.get("n_layers", 3))),
            n_heads=int(config.get("n_heads", 2)),
            dropout=float(config.get("dropout", 0.2525)),
        )
        architecture = "FBNetGenFromGraphEnhanced"
    else:
        model = FBNetGenFromGraph(
            in_dim=in_dim,
            hidden_dim=int(config.get("hidden_dim", 128)),
            n_layers=int(config.get("n_layers", 3)),
            n_heads=int(config.get("n_heads", 2)),
            dropout=float(config.get("dropout", 0.2525)),
            refine_graph=bool(config.get("refine_graph", False)),
        )
        architecture = "FBNetGenFromGraph"

    model.load_state_dict(state_dict, strict=True)
    model.to(device)
    model.eval()
    return model, config, architecture


@torch.no_grad()
def predict_graphs(model: nn.Module, graphs: list[Data], device: torch.device, batch_size: int):
    loader = DataLoader(graphs, batch_size=batch_size, shuffle=False)
    preds = []
    for batch in loader:
        batch = batch.to(device)
        preds.append(model(batch).detach().float().cpu())
    return torch.cat(preds).numpy().reshape(-1)


def maybe_inverse_transform(prediction: float, scaler_path: Path | None):
    if scaler_path is None:
        return None
    try:
        import joblib
    except ImportError as exc:
        raise ImportError("Install joblib to use --scaler_path.") from exc
    scaler = joblib.load(scaler_path)
    return float(scaler.inverse_transform(np.asarray([[prediction]], dtype=float))[0, 0])


def parse_args():
    parser = argparse.ArgumentParser(description="Predict a score using one-file FBNetGen inference.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--timeseries_path", type=Path, help="Uploaded .txt/.csv shaped [time, 268].")
    source.add_argument("--graph_path", type=Path, help="Converted graph payload .pt.")
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--expected_nrois", type=int, default=268)
    parser.add_argument("--wsize", type=int, default=20)
    parser.add_argument("--shift", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=64)
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--scaler_path", type=Path, default=None)
    parser.add_argument("--json", action="store_true", help="Print JSON only.")
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.checkpoint.exists():
        raise FileNotFoundError(f"Checkpoint not found: {args.checkpoint}")

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    if args.timeseries_path is not None:
        if not args.timeseries_path.exists():
            raise FileNotFoundError(f"Time-series file not found: {args.timeseries_path}")
        graphs = timeseries_to_graphs(
            args.timeseries_path,
            expected_nrois=args.expected_nrois,
            wsize=args.wsize,
            shift=args.shift,
        )
        source = str(args.timeseries_path)
    else:
        if not args.graph_path.exists():
            raise FileNotFoundError(f"Graph payload not found: {args.graph_path}")
        graphs = load_graph_payload(args.graph_path)
        source = str(args.graph_path)

    in_dim = int(graphs[0].x.size(-1))
    model, config, architecture = build_model(args.checkpoint, in_dim, device)
    window_predictions = predict_graphs(model, graphs, device, args.batch_size)
    subject_prediction = float(window_predictions.mean())
    original_scale_prediction = maybe_inverse_transform(subject_prediction, args.scaler_path)

    result = {
        "source": source,
        "checkpoint": str(args.checkpoint),
        "architecture": architecture,
        "device": str(device),
        "input_dim": in_dim,
        "n_windows": len(graphs),
        "prediction_normalized": subject_prediction,
        "prediction_original_scale": original_scale_prediction,
        "window_predictions_normalized": window_predictions.tolist(),
        "config": config,
    }

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print("FBNetGen score prediction")
    print(f"  Source: {source}")
    print(f"  Checkpoint: {args.checkpoint}")
    print(f"  Architecture: {architecture}")
    print(f"  Device: {device}")
    print(f"  Windows: {len(graphs)}")
    print(f"  Normalized subject score: {subject_prediction:.6f}")
    if original_scale_prediction is None:
        print("  Original-scale subject score: unavailable; no --scaler_path provided.")
    else:
        print(f"  Original-scale subject score: {original_scale_prediction:.6f}")


if __name__ == "__main__":
    main()
