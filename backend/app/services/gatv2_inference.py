"""
GATv2-based inference loader (PMAT ImprovedGATv2Regressor)

This file provides the GATv2 reconstruction utilities used by the
backend. It mirrors the adapted GATv2 code originally placed under
`braingnn_inference.py` but lives at a clearer module name.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Tuple

import json
import numpy as np
import torch
import torch.nn as nn

try:
    from torch_geometric.nn import GATv2Conv
    from torch_geometric.nn.aggr import AttentionalAggregation
    from torch_geometric.utils import dropout_edge
except Exception:
    GATv2Conv = None  # type: ignore
    AttentionalAggregation = None  # type: ignore
    dropout_edge = None  # type: ignore


class ImprovedGATv2Regressor(nn.Module):
    def __init__(
        self,
        in_dim: int = 268,
        hidden_dim: int = 128,
        n_layers: int = 3,
        n_heads: int = 4,
        dropout: float = 0.2,
        edge_dropout: float = 0.1,
    ):
        super().__init__()
        if GATv2Conv is None or AttentionalAggregation is None:
            raise ImportError("torch_geometric GATv2 classes are required to construct this model.")

        self.edge_dropout = edge_dropout
        self.input_proj = nn.Linear(in_dim, hidden_dim)
        self.gat_layers = nn.ModuleList()
        self.layer_norms = nn.ModuleList()

        for i in range(n_layers):
            heads = n_heads if i < n_layers - 1 else 1
            concat = i < n_layers - 1
            out_dim = hidden_dim // heads if concat else hidden_dim
            self.gat_layers.append(
                GATv2Conv(
                    hidden_dim,
                    out_dim,
                    heads=heads,
                    concat=concat,
                    dropout=dropout,
                )
            )
            self.layer_norms.append(nn.LayerNorm(hidden_dim))

        self.pool = AttentionalAggregation(
            nn.Sequential(nn.Linear(hidden_dim, hidden_dim), nn.ReLU(), nn.Linear(hidden_dim, 1))
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, data: Any):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        x = self.input_proj(x)
        if self.training and getattr(self, "edge_dropout", 0) > 0 and dropout_edge is not None:
            edge_index, _ = dropout_edge(edge_index, p=self.edge_dropout)
        for gat, ln in zip(self.gat_layers, self.layer_norms):
            x = torch.relu(ln(gat(x, edge_index)))
        x = self.pool(x, batch)
        return self.head(x).squeeze(-1)


def is_gatv2_state_dict(state_dict: Dict[str, Any]) -> bool:
    if not isinstance(state_dict, dict):
        return False
    for k in state_dict:
        lk = str(k).lower()
        if lk.startswith("input_proj") or "gat_layers" in lk or "pool" in lk:
            return True
    return False


def build_gatv2_from_checkpoint(checkpoint: Dict[str, Any], *, device: torch.device | None = None):
    state_dict = checkpoint.get("model_state_dict", checkpoint.get("state_dict", checkpoint))
    if not isinstance(state_dict, dict):
        raise ValueError("Checkpoint does not contain a valid state_dict.")
    config = checkpoint.get("config", {}) if isinstance(checkpoint.get("config", {}), dict) else {}

    in_dim = int(config.get("in_dim", 268))
    hidden_dim = int(config.get("hidden_dim", 128))
    n_layers = int(config.get("n_layers", 3))
    n_heads = int(config.get("n_heads", 4))
    dropout = float(config.get("dropout", 0.2))
    edge_dropout = float(config.get("edge_dropout", 0.1))

    model = ImprovedGATv2Regressor(
        in_dim=in_dim,
        hidden_dim=hidden_dim,
        n_layers=n_layers,
        n_heads=n_heads,
        dropout=dropout,
        edge_dropout=edge_dropout,
    )
    model.load_state_dict(state_dict)
    if device is not None:
        model.to(device)
    model.eval()
    return model, "ImprovedGATv2Regressor", config


def load_gatv2_checkpoint(checkpoint_path: Path, *, device: torch.device | None = None):
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    return build_gatv2_from_checkpoint(checkpoint, device=device)


def load_scaler(scaler_json_path: str) -> Dict[str, float]:
    path = Path(scaler_json_path)
    if not path.exists():
        raise FileNotFoundError(f"Scaler JSON not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    if str(payload.get("method", "")).lower() != "standard":
        raise ValueError("Unsupported scaler method; expected 'standard'.")
    mean = float(payload["original_mean"])
    scale = float(payload["original_std"])
    if not (np.isfinite(mean) and np.isfinite(scale) and scale > 0):
        raise ValueError("Invalid scaler statistics.")
    return {"mean": mean, "scale": scale}


def inverse_transform_score(normalised_value: float, scaler: Dict[str, float]) -> float:
    return float(normalised_value) * scaler["scale"] + scaler["mean"]
