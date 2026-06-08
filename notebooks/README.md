# notebooks/

Graph preprocessing modules used by the backend at runtime.

These file are plain
Python modules imported by the backend on every prediction
(`backend/app/services/model_service.py` → `_import_graph_preprocessing_modules`).
They are the source of truth for turning an uploaded time series into GNN input,
and the Dockerfile copies this folder into the image for exactly this reason.

## Pipeline

1. `step1_compute_ldw.py` — cleans the `[timepoints x 268 ROI]` time series,
   slides a window over time, and computes a Ledoit-Wolf-regularized
   correlation/adjacency matrix per window (node features + adjacency).
2. `step2_prepare_data.py` — pads the per-window sequences to equal length and
   converts them into PyTorch-Geometric graph objects the models consume.
