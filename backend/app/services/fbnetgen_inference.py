"""Self-contained FBNetGen inference models used by local score checkpoints."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATv2Conv, global_mean_pool


class GNNPredictor(nn.Module):
    def __init__(
        self,
        in_dim: int = 64,
        hidden_dim: int = 128,
        out_dim: int = 1,
        n_layers: int = 3,
        heads: int = 4,
        dropout: float = 0.3,
    ) -> None:
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
            residual = x
            x = gat(x, edge_index, edge_attr=edge_attr)
            x = norm(F.elu(x))
            if i > 0:
                x = x + residual

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
    ) -> None:
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


class PairNorm(nn.Module):
    def __init__(self, scale: float = 1.0) -> None:
        super().__init__()
        self.scale = scale

    def forward(self, x):
        mean = x.mean(dim=0, keepdim=True)
        centered = x - mean
        l2_norm = torch.norm(centered, p=2, dim=1, keepdim=True) + 1e-6
        return centered / l2_norm * self.scale * math.sqrt(x.size(0))


class EnhancedGNNPredictor(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden_dim: int,
        n_layers: int = 3,
        n_heads: int = 4,
        dropout: float = 0.3,
    ) -> None:
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

        for i, (gat, pairnorm, layer_norm, dropout, residual_proj) in enumerate(
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
            x = layer_norm(x)
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
    ) -> None:
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
                edge_attr = edge_attr if edge_attr.dim() == 2 else edge_attr.unsqueeze(-1)
                edge_weight = edge_attr * attn_score
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


def is_fbnetgen_state_dict(state_dict: Dict[str, Any]) -> bool:
    return any(key.startswith("node_encoder.") or key.startswith("predictor.") for key in state_dict)


def is_enhanced_state_dict(state_dict: Dict[str, Any]) -> bool:
    return any(
        key.startswith("encoder.") or key.startswith("gnn_predictor.") or key.startswith("head.")
        for key in state_dict
    )


def build_fbnetgen_from_checkpoint(
    checkpoint: Dict[str, Any],
    *,
    in_dim: int,
    device: torch.device | None = None,
) -> Tuple[nn.Module, str, Dict[str, Any]]:
    state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    if not isinstance(state_dict, dict):
        raise ValueError("Checkpoint does not contain a valid state_dict.")

    config = checkpoint.get("config", {})
    if not isinstance(config, dict):
        config = {}

    if is_enhanced_state_dict(state_dict):
        model = FBNetGenFromGraphEnhanced(
            in_dim=in_dim,
            hidden_dim=int(config.get("hidden_dim", 128)),
            n_gnn_layers=int(config.get("n_gnn_layers", config.get("n_layers", 3))),
            n_heads=int(config.get("n_heads", 2)),
            dropout=float(config.get("dropout", 0.2525)),
        )
        architecture = "FBNetGenFromGraphEnhanced"
    elif is_fbnetgen_state_dict(state_dict):
        model = FBNetGenFromGraph(
            in_dim=in_dim,
            hidden_dim=int(config.get("hidden_dim", 128)),
            n_layers=int(config.get("n_layers", 3)),
            n_heads=int(config.get("n_heads", 2)),
            dropout=float(config.get("dropout", 0.2525)),
            refine_graph=bool(config.get("refine_graph", False)),
        )
        architecture = "FBNetGenFromGraph"
    else:
        raise ValueError("State dict does not match a supported FBNetGen architecture.")

    model.load_state_dict(state_dict, strict=True)
    if device is not None:
        model.to(device)
    model.eval()
    return model, architecture, config


def load_fbnetgen_checkpoint(
    checkpoint_path: Path,
    *,
    in_dim: int,
    device: torch.device | None = None,
) -> Tuple[nn.Module, str, Dict[str, Any]]:
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    return build_fbnetgen_from_checkpoint(checkpoint, in_dim=in_dim, device=device)
