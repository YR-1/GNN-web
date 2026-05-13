"""Self-contained BrainGNN inference module for PMAT24 score prediction.

Architecture: BrainGNNRegressor (RaGConv × 4 + RPool × 2)
Checkpoint format: { "model_state_dict": ..., "epoch": ..., "val_r": ... }
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv, global_mean_pool


# ---------------------------------------------------------------------------
# Model architecture — must exactly match training
# ---------------------------------------------------------------------------

class RaGConv(nn.Module):
    """ROI-aware Graph Convolution — fully vectorised, no Python loops."""

    def __init__(self, in_channels: int, out_channels: int,
                 n_roi: int = 268, n_clusters: int = 8) -> None:
        super().__init__()
        self.W = nn.Parameter(
            torch.randn(n_clusters, in_channels, out_channels) * 0.01)
        self.roi_assign = nn.Parameter(torch.randn(n_roi, n_clusters) * 0.1)
        self.gcn = GCNConv(out_channels, out_channels, add_self_loops=True)
        self.bn = nn.BatchNorm1d(out_channels)
        self.n_roi = n_roi

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        n_nodes = x.size(0)
        roi_idx = torch.arange(n_nodes, device=x.device) % self.n_roi
        assign = F.softmax(self.roi_assign[roi_idx], dim=-1)
        x_exp = x.unsqueeze(1)
        x_clust = torch.einsum(
            'nci,cio->nco', x_exp.expand(-1, self.W.size(0), -1), self.W)
        x_embed = (x_clust * assign.unsqueeze(-1)).sum(dim=1)
        x_out = self.gcn(x_embed, edge_index)
        x_out = self.bn(x_out)
        return F.relu(x_out)


class RPool(nn.Module):
    """ROI-selection TopK Pooling — fully vectorised."""

    def __init__(self, in_channels: int, ratio: float = 0.5,
                 n_roi: int = 268) -> None:
        super().__init__()
        self.ratio = ratio
        self.n_roi = n_roi
        self.score_proj = nn.Linear(in_channels, 1, bias=False)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        batch: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        n_nodes = x.size(0)
        n_graphs = int(batch.max().item()) + 1

        scores = self.score_proj(x).squeeze(-1)
        scores = scores / (self.score_proj.weight.norm() + 1e-8)
        graph_sizes = torch.bincount(batch, minlength=n_graphs).float()
        k_per_graph = (graph_sizes * self.ratio).long().clamp(min=1)
        offset_scale = scores.abs().max().detach() + 1.0
        scores_shift = scores + batch.float() * offset_scale * 2

        combined_sort = batch.float() * (offset_scale * 4) + scores_shift * -1
        graph_score_order = torch.argsort(combined_sort)
        inv_order = torch.argsort(graph_score_order)
        graph_start = torch.zeros(n_graphs + 1, dtype=torch.long, device=x.device)
        graph_start[1:] = torch.cumsum(graph_sizes.long(), dim=0)
        within_graph_rank = inv_order - graph_start[batch]
        keep_mask = within_graph_rank < k_per_graph[batch]
        perm = keep_mask.nonzero(as_tuple=False).squeeze(-1)

        x_out = x[perm] * torch.sigmoid(scores[perm]).unsqueeze(-1)
        node_remap = torch.full((n_nodes,), -1, dtype=torch.long, device=x.device)
        node_remap[perm] = torch.arange(perm.size(0), device=x.device)
        src, dst = edge_index
        keep_edges = (node_remap[src] >= 0) & (node_remap[dst] >= 0)
        edge_out = node_remap[edge_index[:, keep_edges]]
        batch_out = batch[perm]
        return x_out, edge_out, batch_out, scores, perm


class BrainGNNRegressor(nn.Module):
    """BrainGNN-style GNN for continuous cognitive score regression.

    Default hyperparameters match the trained pmat.pt checkpoint:
      in_dim=268, hidden_dim=64, pooling_ratio=0.5,
      n_roi=268, n_clusters=8, dropout=0.3
    """

    def __init__(
        self,
        in_dim: int = 268,
        hidden_dim: int = 64,
        pooling_ratio: float = 0.5,
        n_roi: int = 268,
        n_clusters: int = 8,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        self.dropout = dropout
        self.conv1 = RaGConv(in_dim, hidden_dim, n_roi, n_clusters)
        self.conv1b = RaGConv(hidden_dim, hidden_dim, n_roi, n_clusters)
        self.pool1 = RPool(hidden_dim, ratio=pooling_ratio, n_roi=n_roi)
        self.conv2 = RaGConv(hidden_dim, hidden_dim, n_roi, n_clusters)
        self.conv2b = RaGConv(hidden_dim, hidden_dim, n_roi, n_clusters)
        self.pool2 = RPool(hidden_dim, ratio=pooling_ratio, n_roi=n_roi)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, 64), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, 32),         nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(32, 1),
        )

    def forward(self, data: Any, return_scores: bool = False):
        x, ei, batch = data.x, data.edge_index, data.batch
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv1(x, ei)
        x = self.conv1b(x, ei)
        x, ei, batch, scores1, perm1 = self.pool1(x, ei, batch)
        x = F.dropout(x, p=self.dropout, training=self.training)
        x = self.conv2(x, ei)
        x = self.conv2b(x, ei)
        x, ei, batch, _, _ = self.pool2(x, ei, batch)
        x = global_mean_pool(x, batch)
        pred = self.head(x).squeeze(-1)
        if return_scores:
            return pred, scores1, perm1
        return pred


# ---------------------------------------------------------------------------
# Detection + build
# ---------------------------------------------------------------------------

def is_braingnn_state_dict(state_dict: Dict[str, Any]) -> bool:
    """Detect BrainGNN checkpoints by their unique parameter key pattern."""
    return "conv1.W" in state_dict and "pool1.score_proj.weight" in state_dict


def build_braingnn_from_checkpoint(
    checkpoint: Dict[str, Any],
    *,
    device: torch.device | None = None,
) -> Tuple[nn.Module, str, Dict[str, Any]]:
    """Reconstruct a BrainGNNRegressor from a checkpoint dict.

    Args:
        checkpoint: dict with "model_state_dict" key (and optionally "config")
        device:     torch device to place the model on

    Returns:
        (model_in_eval_mode, architecture_name, config_dict)

    Raises:
        ValueError: if the state_dict does not look like a BrainGNN checkpoint
                    or if load_state_dict fails
    """
    state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    if not isinstance(state_dict, dict):
        raise ValueError("Checkpoint does not contain a valid state_dict.")

    if not is_braingnn_state_dict(state_dict):
        raise ValueError("State dict does not match BrainGNN architecture "
                         "(missing 'conv1.W' or 'pool1.score_proj.weight').")

    config = checkpoint.get("config", {})
    if not isinstance(config, dict):
        config = {}

    model = BrainGNNRegressor(
        in_dim=int(config.get("in_dim", 268)),
        hidden_dim=int(config.get("hidden_dim", 64)),
        pooling_ratio=float(config.get("pooling_ratio", 0.5)),
        n_roi=int(config.get("n_roi", 268)),
        n_clusters=int(config.get("n_clusters", 8)),
        dropout=float(config.get("dropout", 0.3)),
    )
    model.load_state_dict(state_dict, strict=True)
    if device is not None:
        model.to(device)
    model.eval()
    return model, "BrainGNNRegressor", config


def load_braingnn_checkpoint(
    checkpoint_path: Path,
    *,
    device: torch.device | None = None,
) -> Tuple[nn.Module, str, Dict[str, Any]]:
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    return build_braingnn_from_checkpoint(checkpoint, device=device)
