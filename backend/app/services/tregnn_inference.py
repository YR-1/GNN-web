"""
T-RegGNN v17 inference adapter (per-window).

Why this file is much shorter than inference.py
================================================
inference.py is the STANDALONE library/CLI — it does atlas loading, file I/O,
Integrated Gradients, occlusion, sequence-level temporal attention, and
assembles a consolidated XAI JSON itself.

This file is the BACKEND ADAPTER, it only needs to expose a detector + a builder. The
backend already supplies file loading, graph construction, mean+CI
aggregation, gradient-based XAI, visualisations, and persistence.

Training-faithfulness
=====================
Training called `model(adj, adj, lengths)` and inside `encode_window` did
`gc1(x_w, adj_w)` where x_w == adj_w. The backend's step1_compute_ldw
produces node features whose rows are the ROI's connectivity vector, so
`batch.x` per graph IS the (R, R) connectivity matrix. This adapter
therefore calls `gc1(x, x)` — identical math to training.

What's given up vs training: temporal attention across the T windows. The
backend gives one window at a time and averages predictions externally with
mean + 95% CI in `_predict_single_score_model`, so this adapter is the
per-window encoder slice of v17 applied independently per window.

Un-z-scoring
============
The v17 .pt stores `y_mean` / `y_std`. This adapter applies the inverse
transform inside `forward` (returns original units) and is tagged
`_prediction_scale = "original"` by the backend wiring — so no sibling
`*_target_scaler.json` is required.
"""

from typing import Dict, Any, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from torch_geometric.nn.dense import DenseGCNConv
except Exception as _exc:        # noqa: BLE001
    DenseGCNConv = None
    _IMPORT_ERROR = _exc
else:
    _IMPORT_ERROR = None


# ──────────────────────────────────────────────────────────────────────────────
# Detection
# ──────────────────────────────────────────────────────────────────────────────
def is_tregnn_state_dict(state_dict: Dict[str, Any]) -> bool:
    """True iff this state_dict was produced by training-time TRegGNNv2."""
    if not isinstance(state_dict, dict):
        return False
    keys = set(state_dict.keys())
    # These four keys together are unique to TRegGNNv2.
    return (
        "attn_query"         in keys
        and "gc1.lin.weight" in keys
        and "gn_ln.weight"   in keys
        and "head.weight"    in keys
    )


# ──────────────────────────────────────────────────────────────────────────────
# Adapter model
# ──────────────────────────────────────────────────────────────────────────────
class TRegGNNv2PerWindow(nn.Module):
    """Module layout matches training exactly so the full v17 state_dict
    loads with strict=True. Forward runs the per-window slice only."""

    def __init__(self, n_roi: int, gnn_hidden: int, attn_hidden: int,
                 dropout: float, y_mean: float, y_std: float):
        super().__init__()
        if DenseGCNConv is None:
            raise RuntimeError(
                f"torch_geometric is required for T-RegGNN inference: {_IMPORT_ERROR}"
            )
        self.n_roi   = int(n_roi)
        self.dropout = float(dropout)

        # Same modules + same names as training (so state_dict matches).
        self.gc1     = DenseGCNConv(self.n_roi, gnn_hidden)
        self.gc2     = DenseGCNConv(gnn_hidden, gnn_hidden)
        self.gn_ln   = nn.LayerNorm(gnn_hidden)

        # Temporal-attention params — registered for state_dict compatibility
        # but UNUSED in the per-window forward.
        self.attn_proj  = nn.Linear(gnn_hidden, attn_hidden)
        self.attn_query = nn.Parameter(torch.zeros(attn_hidden))
        self.t_ln       = nn.LayerNorm(gnn_hidden)

        self.head    = nn.Linear(gnn_hidden, 1)

        # Plain attributes — NOT in state_dict.
        self.y_mean  = float(y_mean)
        self.y_std   = float(y_std)

    # ── One-graph encoder — training-faithful: features = adjacency ─────────
    def _encode_window(self, x_rr: torch.Tensor) -> torch.Tensor:
        """x_rr: (R, R) — node features whose rows are the ROI's connectivity
        vector. Training used the same matrix as features AND adjacency."""
        x_b = x_rr.unsqueeze(0)                          # (1, R, R)
        h = F.relu(self.gc1(x_b, x_b))
        h = F.dropout(h, p=self.dropout, training=self.training)
        h = self.gc2(h, x_b)
        h = h.mean(dim=1)                                # (1, H)
        h = self.gn_ln(h)
        return h.squeeze(0)                              # (H,)

    # ── PyG-style forward matching the backend's _forward_model attempt ─────
    def forward(self, x: torch.Tensor,
                 edge_index: torch.Tensor = None,
                 edge_attr:  torch.Tensor = None,
                 batch:      torch.Tensor = None) -> torch.Tensor:
        """Per-batch forward. Returns (B,) un-z-scored predictions."""
        device = next(self.parameters()).device
        x = x.to(device).float()

        if x.dim() != 2:
            raise ValueError(
                f"Expected node features of shape (N, R), got {tuple(x.shape)}"
            )
        if x.shape[1] != self.n_roi:
            raise ValueError(
                f"Expected ROI feature width {self.n_roi}, got {x.shape[1]}"
            )

        if batch is None:
            batch = torch.zeros(x.shape[0], dtype=torch.long, device=device)
        else:
            batch = batch.to(device)

        n_graphs = int(batch.max().item()) + 1 if batch.numel() > 0 else 1
        preds = []
        for g in range(n_graphs):
            node_ids = (batch == g).nonzero(as_tuple=False).reshape(-1)
            if node_ids.numel() == 0:
                preds.append(torch.zeros((), device=device))
                continue

            x_g = x[node_ids]                            # (R, R)
            # Same sanitisation as training-time SubjectSequenceDatasetV2.
            x_g = torch.abs(x_g)
            x_g = x_g - torch.diag(torch.diag(x_g))

            emb = self._encode_window(x_g)               # (H,)
            z   = self.head(emb).squeeze()               # z-scored scalar
            preds.append(z)

        z_batch = torch.stack(preds, dim=0)              # (B,)
        return z_batch * self.y_std + self.y_mean        # original units


# ──────────────────────────────────────────────────────────────────────────────
# Builder 
# ──────────────────────────────────────────────────────────────────────────────
def build_tregnn_from_checkpoint(
    loaded_obj: Dict[str, Any],
) -> Tuple[TRegGNNv2PerWindow, str, None]:
    """Build a per-window T-RegGNN adapter from a v17 checkpoint dict."""
    state_dict = (
        loaded_obj.get("model_state_dict")
        or loaded_obj.get("state_dict")
        or loaded_obj
    )

    n_roi       = int(loaded_obj.get("roi",         268))
    gnn_hidden  = int(loaded_obj.get("gnn_hidden",   8))
    attn_hidden = int(loaded_obj.get("attn_hidden",  8))
    dropout     = float(loaded_obj.get("dropout",   0.5))
    y_mean      = float(loaded_obj.get("y_mean",    0.0))
    y_std       = float(loaded_obj.get("y_std",     1.0))

    model = TRegGNNv2PerWindow(
        n_roi=n_roi, gnn_hidden=gnn_hidden, attn_hidden=attn_hidden,
        dropout=dropout, y_mean=y_mean, y_std=y_std,
    )
    # strict=True works because the module layout exactly matches training,
    # including the (unused) attention params.
    model.load_state_dict(state_dict, strict=True)
    model.eval()

    return model, "TRegGNNv2 (per-window adapter)", None