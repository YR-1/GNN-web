#!/usr/bin/env python
"""
Convert one ROI time-series .txt/.csv/.tsv file into PyG graph windows.

This script reuses the same computations as training:
- step1_compute_ldw.extract_ldw_corr
- step2_prepare_data.pad_graph_seq
- step2_prepare_data.convert2graphs
"""

import argparse
from pathlib import Path

import numpy as np
import torch

import step1_compute_ldw
import step2_prepare_data


def clean_timeseries(ts: np.ndarray, expected_nrois: int):
    if ts.ndim == 1:
        ts = ts[:, np.newaxis]
    if ts.ndim != 2:
        raise ValueError(f"Expected 2D time-series array, got shape {ts.shape}")

    if ts.shape[0] == expected_nrois and ts.shape[1] != expected_nrois:
        ts = ts.T

    zero_rows = np.all(np.isclose(ts, 0.0), axis=1)
    if np.any(zero_rows):
        ts = ts[~zero_rows, :]

    zero_cols = np.all(np.isclose(ts, 0.0), axis=0)
    zero_cols_found = int(np.count_nonzero(zero_cols))
    return ts, zero_cols_found


def load_single_timeseries(txt_path: Path, expected_nrois: int) -> np.ndarray:
    ext = txt_path.suffix.lower()
    delimiter = "," if ext == ".csv" else "\t" if ext == ".tsv" else None
    ts = np.loadtxt(txt_path, delimiter=delimiter)
    ts, zero_cols_found = clean_timeseries(ts, expected_nrois)

    if zero_cols_found > 0:
        raise ValueError(
            f"Found {zero_cols_found} zero-only ROI columns in {txt_path.name}. "
            "This run does not match the expected atlas ROI set."
        )
    if ts.shape[1] != expected_nrois:
        raise ValueError(
            f"Expected {expected_nrois} ROIs after cleaning, got shape {ts.shape}."
        )
    if ts.shape[0] < 2:
        raise ValueError(f"Not enough timepoints after cleaning: shape={ts.shape}")
    return ts


def flatten_non_padding(graphs_2d):
    flat = []
    for row in graphs_2d:
        for graph in row:
            if hasattr(graph, "pad") and bool(graph.pad):
                continue
            flat.append(graph)
    return flat


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert one ROI time-series file into graph windows."
    )
    parser.add_argument("--txt_path", type=str, required=True, help="Input time-series file (.txt/.csv/.tsv)")
    parser.add_argument(
        "--output_path",
        type=str,
        default="data/single_input/single_graph_windows.pt",
        help="Output .pt path",
    )
    parser.add_argument("--expected_nrois", type=int, default=268, help="Expected number of ROIs")
    parser.add_argument("--wsize", type=int, default=20, help="Sliding window size")
    parser.add_argument("--shift", type=int, default=10, help="Sliding window shift")
    parser.add_argument(
        "--target",
        type=float,
        default=0.0,
        help="Dummy target value for Data.y (unused during inference)",
    )
    parser.add_argument(
        "--score_name",
        type=str,
        default="listsort_ageadj",
        help="Score/model name this graph payload is intended for",
    )
    parser.add_argument(
        "--subject_id",
        type=int,
        default=0,
        help="Integer subject id to attach for downstream grouping",
    )
    args = parser.parse_args()

    txt_path = Path(args.txt_path)
    if not txt_path.exists():
        raise FileNotFoundError(f"Input file not found: {txt_path}")

    ts = load_single_timeseries(txt_path, args.expected_nrois)
    print(f"Loaded: {txt_path}")
    print(f"Time-series shape: {ts.shape} (T, ROI)")

    node_feats, adj_mats, nwin = step1_compute_ldw.extract_ldw_corr(
        [ts], wSize=args.wsize, shift=args.shift
    )
    print(f"Extracted windows: {nwin[0]}")

    corr_padded, seqlens = step2_prepare_data.pad_graph_seq(node_feats)
    adj_padded, _ = step2_prepare_data.pad_graph_seq(adj_mats)
    scores = np.asarray([args.target], dtype=float)

    graphs_2d = step2_prepare_data.convert2graphs(corr_padded, adj_padded, seqlens, scores)
    graphs_flat = flatten_non_padding(graphs_2d)

    for graph in graphs_flat:
        graph.subject_id = torch.tensor([args.subject_id], dtype=torch.long)
        graph.score_name = args.score_name

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "source_txt": str(txt_path),
        "time_series_shape": list(ts.shape),
        "expected_nrois": args.expected_nrois,
        "wsize": args.wsize,
        "shift": args.shift,
        "n_windows": int(nwin[0]),
        "score_name": args.score_name,
        "graphs_2d": graphs_2d,       # [subject, window]
        "graphs_flat": graphs_flat,   # non-padding only
        "dummy_target": args.target,
    }
    torch.save(payload, output_path)
    print(f"Saved converted graphs to: {output_path}")


if __name__ == "__main__":
    main()
