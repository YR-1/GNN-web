import asyncio
import base64
import copy
import io
import json
import numpy as np
import sys
import warnings
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from .database import save_execution_results, set_execution_status
from ..core.config import get_settings
from ..core.model_registry import build_model_registry, normalize_score_name
from sklearn.covariance import ledoit_wolf
import plotly.graph_objects as go
from plotly.utils import PlotlyJSONEncoder
from pathlib import Path
from ..data.shen268_mni_coords import SHEN268_MNI_COORDS


def cov2corr(covariance: np.ndarray) -> np.ndarray:
    """Convert covariance matrix to correlation matrix."""
    v = np.sqrt(np.diag(covariance))
    outer_v = np.outer(v, v)
    corr = covariance / outer_v
    corr[covariance == 0] = 0
    return corr


def compute_corr(ts: np.ndarray, method: str = "pearson") -> np.ndarray:
    """
    Compute correlation matrix from time-series data.
    
    Args:
        ts: 2D array (T, N_ROI) - time points x ROI regions
        method: "pearson" or "ldw" (Ledoit-Wolf)
    
    Returns:
        Correlation matrix (N_ROI x N_ROI)
    """
    if ts.ndim != 2:
        raise ValueError(f"Expected 2D array (T, N_ROI), got shape {ts.shape}")

    if method == "pearson":
        return np.corrcoef(ts, rowvar=False)
    if method == "ldw":
        cov, _ = ledoit_wolf(ts, assume_centered=False)
        return cov2corr(cov)
    raise ValueError(f"Unknown method: {method}")


def create_plotly_heatmap(corr: np.ndarray, title: str = "") -> Dict[str, Any]:
    """
    Create Plotly heatmap JSON for frontend visualization.
    
    Args:
        corr: Correlation matrix
        title: Plot title
    
    Returns:
        Plotly figure as dictionary
    """
    fig = go.Figure(
        data=go.Heatmap(
            z=corr,
            colorscale="RdBu",
            zmid=0,
            zmin=-1,
            zmax=1,
            colorbar=dict(title="Correlation"),
        )
    )
    fig.update_layout(
        title=title or "ROI Correlation Matrix",
        xaxis_title="ROI Index",
        yaxis_title="ROI Index",
        height=700,
        width=800,
    )
    # Normalize Plotly output to plain JSON-compatible types (no numpy objects).
    return json.loads(json.dumps(fig, cls=PlotlyJSONEncoder))


def _build_compact_plot_title(
    prefix: str,
    file_name: str,
    *,
    max_file_chars: int = 28,
) -> str:
    """Build short, readable titles for plot surfaces and embedded viewers."""
    base = (prefix or "").strip() or "Plot"
    cleaned_name = (file_name or "").strip()
    if not cleaned_name:
        return base

    stem = Path(cleaned_name).stem
    if not stem:
        return base

    if len(stem) > max_file_chars:
        stem = f"{stem[: max_file_chars - 3]}..."

    return f"{base} | {stem}"


def _get_roi_label(roi_index: int) -> str:
    """Return a human-readable label for a 1-indexed Shen-268 ROI."""
    LEFT_LOBES = [
        ("Prefrontal", 1, 22), ("Motor", 23, 38), ("Insula", 39, 43),
        ("Parietal", 44, 62), ("Temporal", 63, 82), ("Occipital", 83, 100),
        ("Limbic", 101, 110), ("Subcortical", 111, 121), ("Cerebellum", 122, 134),
    ]
    RIGHT_LOBES = [
        ("Prefrontal", 135, 156), ("Motor", 157, 172), ("Insula", 173, 177),
        ("Parietal", 178, 196), ("Temporal", 197, 216), ("Occipital", 217, 234),
        ("Limbic", 235, 244), ("Subcortical", 245, 255), ("Cerebellum", 256, 268),
    ]
    for lobe, start, end in LEFT_LOBES:
        if start <= roi_index <= end:
            return f"L {lobe} #{roi_index - start + 1}"
    for lobe, start, end in RIGHT_LOBES:
        if start <= roi_index <= end:
            return f"R {lobe} #{roi_index - start + 1}"
    return f"ROI {roi_index}"


def _get_shen268_coordinates(n_rois: int) -> List[Tuple[float, float, float]]:
    """Return real Shen268 MNI centroid coordinates for the first n_rois parcels."""
    if n_rois <= 0:
        return []
    if n_rois > len(SHEN268_MNI_COORDS):
        raise ValueError(
            f"Requested {n_rois} ROI coordinates but Shen268 atlas only has "
            f"{len(SHEN268_MNI_COORDS)} entries."
        )
    return SHEN268_MNI_COORDS[:n_rois]


def _build_top_k_adjacency(corr: np.ndarray, k: int = 3) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """Build sparse adjacency using global top-k absolute correlations (upper triangle)."""
    n_rois = corr.shape[0]
    adjacency = np.zeros_like(corr, dtype=float)
    if n_rois < 2 or k <= 0:
        return adjacency, []

    tri_i, tri_j = np.triu_indices(n_rois, k=1)
    values = corr[tri_i, tri_j]
    finite_mask = np.isfinite(values)
    if not np.any(finite_mask):
        return adjacency, []

    tri_i = tri_i[finite_mask]
    tri_j = tri_j[finite_mask]
    values = values[finite_mask]
    abs_values = np.abs(values)

    top_count = min(k, abs_values.size)
    if top_count == 0:
        return adjacency, []

    top_idx = np.argpartition(abs_values, -top_count)[-top_count:]
    top_idx = top_idx[np.argsort(abs_values[top_idx])[::-1]]

    top_links: List[Dict[str, Any]] = []
    for idx in top_idx:
        i = int(tri_i[idx])
        j = int(tri_j[idx])
        weight = float(values[idx])
        adjacency[i, j] = weight
        adjacency[j, i] = weight
        top_links.append(
            {
                "source_roi": i + 1,
                "target_roi": j + 1,
                "weight": weight,
                "abs_weight": float(abs(weight)),
                "sign": "positive" if weight >= 0 else "negative",
                "source_label": _get_roi_label(i + 1),
                "target_label": _get_roi_label(j + 1),
            }
        )

    return adjacency, top_links


def create_nilearn_connectome_payload(
    corr: np.ndarray,
    *,
    top_k: int = 3,
    title: str = "Nilearn Connectome (Top 3 Global Links)",
) -> Dict[str, Any]:
    """Build an interactive nilearn connectome HTML payload using top global links."""
    try:
        from nilearn import plotting
    except Exception as exc:
        return {
            "html": None,
            "top_links": [],
            "top_link_count": 0,
            "library": "nilearn.view_connectome",
            "coordinates_source": "shen268_mni_atlas",
            "error": f"nilearn unavailable: {exc}",
        }

    adjacency, top_links = _build_top_k_adjacency(corr, k=top_k)
    coords = _get_shen268_coordinates(corr.shape[0])

    try:
        connectome_view = plotting.view_connectome(
            adjacency_matrix=adjacency,
            node_coords=coords,
            edge_threshold=None,
            edge_cmap="RdBu_r",
            symmetric_cmap=True,
            linewidth=6.0,
            node_size=5.5,
            colorbar=True,
            colorbar_fontsize=13,
            title=title,
            title_fontsize=14,
        )
        html = getattr(connectome_view, "html", None) or connectome_view._repr_html_()
    except Exception as exc:
        return {
            "html": None,
            "top_links": top_links,
            "top_link_count": len(top_links),
            "library": "nilearn.view_connectome",
            "coordinates_source": "shen268_mni_atlas",
            "error": f"Failed to render nilearn connectome: {exc}",
        }

    return {
        "html": html,
        "top_links": top_links,
        "top_link_count": len(top_links),
        "library": "nilearn.view_connectome",
        "coordinates_source": "shen268_mni_atlas",
        "error": None,
    }


def create_nilearn_markers_payload(
    corr: np.ndarray,
    *,
    top_links: Optional[List[Dict[str, Any]]] = None,
    top_k: int = 3,
    title: str = "Node strength from top 3 global links",
) -> Dict[str, Any]:
    """
    Build static nilearn marker image (orthogonal 3-view) as PNG base64.
    Node values are strengths derived from top global links.
    """
    try:
        from nilearn import plotting
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as exc:
        return {
            "png_base64": None,
            "library": "nilearn.plot_markers",
            "view": "ortho",
            "error": f"nilearn unavailable: {exc}",
        }

    if top_links is None:
        _, top_links = _build_top_k_adjacency(corr, k=top_k)

    coords = _get_shen268_coordinates(corr.shape[0])
    node_values = np.zeros(corr.shape[0], dtype=float)
    for link in top_links:
        source = int(link["source_roi"]) - 1
        target = int(link["target_roi"]) - 1
        weight = float(link.get("abs_weight", abs(float(link["weight"]))))
        if 0 <= source < corr.shape[0]:
            node_values[source] += weight
        if 0 <= target < corr.shape[0]:
            node_values[target] += weight

    vmax = float(np.max(node_values)) if float(np.max(node_values)) > 0 else 1.0

    try:
        figure = plt.figure(figsize=(11.5, 4.0), dpi=130)
        plotting.plot_markers(
            node_values=node_values.tolist(),
            node_coords=coords,
            display_mode="ortho",
            node_size=56,
            node_cmap="YlOrRd",
            node_vmin=0.0,
            node_vmax=vmax,
            alpha=0.9,
            title=title,
            annotate=False,
            black_bg=False,
            figure=figure,
            colorbar=True,
        )

        image_buffer = io.BytesIO()
        figure.savefig(image_buffer, format="png", bbox_inches="tight")
        plt.close(figure)
        png_base64 = base64.b64encode(image_buffer.getvalue()).decode("utf-8")
    except Exception as exc:
        return {
            "png_base64": None,
            "library": "nilearn.plot_markers",
            "view": "ortho",
            "error": f"Failed to render nilearn marker plot: {exc}",
        }

    return {
        "png_base64": png_base64,
        "library": "nilearn.plot_markers",
        "view": "ortho",
        "error": None,
    }


EXPECTED_NROIS = 268
DEFAULT_WSIZE = 20
DEFAULT_SHIFT = 10
DEFAULT_XAI_TOP_K_EDGES = 10
DEFAULT_XAI_TOP_K_WINDOWS = 3


def _load_timeseries_file(file_path: str, expected_nrois: int = EXPECTED_NROIS) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Load and clean one ROI time-series file into [T, ROI] shape."""
    ext = Path(file_path).suffix.lower()
    delimiter = "," if ext == ".csv" else "\t" if ext == ".tsv" else None
    try:
        ts = np.loadtxt(file_path, delimiter=delimiter)
    except ValueError as exc:
        raise ValueError(
            "Unable to parse uploaded file as a numeric matrix. "
            "Please ensure the file is not empty and contains only numeric values "
            "separated by spaces/tabs (or commas for CSV)."
        ) from exc

    if ts.ndim == 1:
        ts = ts[:, np.newaxis]
    if ts.ndim != 2:
        raise ValueError(f"Expected 2D time-series array, got shape {ts.shape}")

    if not np.isfinite(ts).all():
        raise ValueError(
            "Input contains invalid numeric values (NaN or Infinity). "
            "Please clean the file and re-upload."
        )

    transposed = False
    if ts.shape[0] == expected_nrois and ts.shape[1] != expected_nrois:
        ts = ts.T
        transposed = True

    zero_rows = np.all(np.isclose(ts, 0.0), axis=1)
    zero_rows_removed = int(np.count_nonzero(zero_rows))
    if zero_rows_removed:
        ts = ts[~zero_rows, :]

    zero_cols = np.all(np.isclose(ts, 0.0), axis=0)
    zero_cols_found = int(np.count_nonzero(zero_cols))
    if zero_cols_found:
        raise ValueError(
            f"Found {zero_cols_found} zero-only ROI columns. "
            "Input does not match expected atlas ROI coverage."
        )

    if ts.shape[1] != expected_nrois:
        raise ValueError(
            f"Expected {expected_nrois} ROIs after cleaning, got shape {ts.shape}. "
            "Please provide [T, ROI] with matching ROI count."
        )
    if ts.shape[0] < 2:
        raise ValueError(f"Not enough timepoints after cleaning: shape={ts.shape}")

    metadata = {
        "transposed": transposed,
        "zero_rows_removed": zero_rows_removed,
        "zero_cols_found": zero_cols_found,
    }
    return ts, metadata


def _import_graph_preprocessing_modules():
    """Import step1/step2 preprocessing modules from notebooks folder."""
    project_root = Path(__file__).resolve().parents[3]
    notebooks_dir = project_root / "notebooks"
    if str(notebooks_dir) not in sys.path:
        sys.path.insert(0, str(notebooks_dir))

    import step1_compute_ldw  # type: ignore
    import step2_prepare_data  # type: ignore

    return step1_compute_ldw, step2_prepare_data


def _convert_timeseries_to_graph_windows(
    ts: np.ndarray,
    *,
    wsize: int = DEFAULT_WSIZE,
    shift: int = DEFAULT_SHIFT,
    target: float = 0.0,
) -> Dict[str, Any]:
    """
    Convert [T, ROI] time-series into graph windows using step1/step2 source-of-truth scripts.
    """
    step1_compute_ldw, step2_prepare_data = _import_graph_preprocessing_modules()

    node_feats, adj_mats, nwin = step1_compute_ldw.extract_ldw_corr(
        [ts], wSize=wsize, shift=shift
    )
    corr_padded, seqlens = step2_prepare_data.pad_graph_seq(node_feats)
    adj_padded, _ = step2_prepare_data.pad_graph_seq(adj_mats)

    scores = np.asarray([target], dtype=float)
    graphs_2d = step2_prepare_data.convert2graphs(corr_padded, adj_padded, seqlens, scores)

    graphs_flat = []
    for row in graphs_2d:
        for graph in row:
            if hasattr(graph, "pad") and bool(graph.pad):
                continue
            graphs_flat.append(graph)

    return {
        "graphs_2d": graphs_2d,
        "graphs_flat": graphs_flat,
        "n_windows": int(nwin[0]) if nwin else len(graphs_flat),
        "wsize": wsize,
        "shift": shift,
    }


def _import_gatv2_model_classes():
    """Import local training-time GATv2 model classes for checkpoint reconstruction."""
    project_root = Path(__file__).resolve().parents[4]
    training_dir = project_root / "GNN-mri" / "training" / "gatv2"
    if not training_dir.exists():
        raise FileNotFoundError(f"GATv2 training module path not found: {training_dir}")

    if str(training_dir) not in sys.path:
        sys.path.insert(0, str(training_dir))

    improved_cls = None
    basic_cls = None

    try:
        from train_gatv2_improved import ImprovedGATv2Regressor  # type: ignore
        improved_cls = ImprovedGATv2Regressor
    except Exception:
        improved_cls = None

    try:
        from train_gatv2_basic import GATv2Regressor  # type: ignore
        basic_cls = GATv2Regressor
    except Exception:
        basic_cls = None

    return improved_cls, basic_cls


def _infer_input_dim_from_checkpoint(state_dict: Dict[str, Any], sample_graph: Any | None = None) -> int:
    """Infer node feature dimension from a graph sample or checkpoint weights."""
    if sample_graph is not None and hasattr(sample_graph, "x") and sample_graph.x is not None:
        return int(sample_graph.x.shape[-1])

    for key in ("input_proj.weight", "gat1.lin_l.weight", "gat1.lin_r.weight"):
        weight = state_dict.get(key)
        if weight is not None and hasattr(weight, "shape") and len(weight.shape) >= 2:
            return int(weight.shape[1])

    raise ValueError("Unable to infer model input dimension from checkpoint.")


def _rebuild_model_from_checkpoint(loaded_obj: Dict[str, Any], sample_graph: Any | None = None):
    """Reconstruct supported GATv2 architectures from checkpoint dictionaries."""
    state_dict = loaded_obj.get("model_state_dict") or loaded_obj.get("state_dict") or loaded_obj
    if not isinstance(state_dict, dict):
        raise ValueError("Checkpoint does not contain a valid state_dict payload.")

    config = loaded_obj.get("config", {}) if isinstance(loaded_obj.get("config", {}), dict) else {}
    in_dim = _infer_input_dim_from_checkpoint(state_dict, sample_graph)
    improved_cls, basic_cls = _import_gatv2_model_classes()

    build_errors: List[str] = []

    if improved_cls is not None:
        try:
            model = improved_cls(
                in_dim=in_dim,
                hidden_dim=int(config.get("hidden_dim", 64)),
                n_layers=int(config.get("n_layers", 3)),
                n_heads=int(config.get("n_heads", 4)),
                dropout=float(config.get("dropout", 0.2)),
                edge_dropout=float(config.get("edge_dropout", 0.1)),
                out_dim=1,
                use_global_attention_pool=bool(config.get("use_global_attention_pool", True)),
            )
            model.load_state_dict(state_dict)
            model.eval()
            return model
        except Exception as exc:
            build_errors.append(f"ImprovedGATv2Regressor: {exc}")

    if basic_cls is not None:
        try:
            model = basic_cls(
                in_dim=in_dim,
                hidden_dim=int(config.get("hidden_dim", 32)),
                out_dim=1,
                use_global_attention_pool=bool(config.get("use_global_attention_pool", True)),
            )
            model.load_state_dict(state_dict)
            model.eval()
            return model
        except Exception as exc:
            build_errors.append(f"GATv2Regressor: {exc}")

    raise ValueError(
        "Model checkpoint contains a state_dict but backend could not reconstruct a supported model class. "
        + " | ".join(build_errors)
    )


def _resolve_inference_model(loaded_obj: Any, sample_graph: Any | None = None):
    """Resolve a torch model object from a loaded .pt payload."""
    if hasattr(loaded_obj, "eval"):
        loaded_obj.eval()
        return loaded_obj

    if isinstance(loaded_obj, dict):
        for key in ("model", "module"):
            candidate = loaded_obj.get(key)
            if hasattr(candidate, "eval"):
                candidate.eval()
                return candidate

        if "state_dict" in loaded_obj or "model_state_dict" in loaded_obj:
            return _rebuild_model_from_checkpoint(loaded_obj, sample_graph=sample_graph)

    raise ValueError("Unsupported model format. Expected a loadable model object in .pt file.")


def _load_score_model(model_path: Path, sample_graph: Any | None = None) -> Any:
    """Load one local score model for inference and explanation."""
    import torch
    from sklearn.exceptions import InconsistentVersionWarning

    print(f"[model] Loading checkpoint from: {model_path}")
    with warnings.catch_warnings():
        # The website does not use the serialized sklearn scaler object for inference.
        warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
        try:
            # PyTorch >=2.6 defaults to weights_only=True; force full object load for trusted local model files.
            loaded = torch.load(model_path, map_location="cpu", weights_only=False)
        except TypeError:
            loaded = torch.load(model_path, map_location="cpu")
    model = _resolve_inference_model(loaded, sample_graph=sample_graph)
    print(f"[model] Loaded model successfully: {model_path.name} -> {type(model).__name__}")
    return model


def _extract_output_values(output: Any) -> List[float]:
    """Convert model output to a flat list of floats."""
    try:
        import torch
    except Exception:
        torch = None

    if isinstance(output, (list, tuple)):
        if not output:
            return []
        output = output[0]

    if torch is not None and isinstance(output, torch.Tensor):
        return output.detach().cpu().reshape(-1).float().tolist()

    if np.isscalar(output):
        return [float(output)]

    array = np.asarray(output).reshape(-1)
    return [float(x) for x in array]


def _extract_output_tensor(output: Any):
    """Normalize model output to a tensor-like object for scalar explanation targets."""
    import torch

    if isinstance(output, (list, tuple)):
        if not output:
            raise ValueError("Model returned an empty output container.")
        output = output[0]

    if not isinstance(output, torch.Tensor):
        output = torch.as_tensor(output, dtype=torch.float32)

    if output.numel() == 0:
        raise ValueError("Model returned an empty tensor output.")

    return output.reshape(-1)


def _forward_model(model: Any, batch: Any) -> Any:
    """
    Try common forward signatures used by PyG and plain PyTorch models.
    """
    attempts = [
        lambda: model(batch),
    ]

    if hasattr(batch, "x") and hasattr(batch, "edge_index"):
        if hasattr(batch, "edge_attr") and hasattr(batch, "batch"):
            attempts.append(lambda: model(batch.x, batch.edge_index, batch.edge_attr, batch.batch))
        if hasattr(batch, "batch"):
            attempts.append(lambda: model(batch.x, batch.edge_index, batch.batch))
        attempts.append(lambda: model(batch.x, batch.edge_index))

    last_error: Optional[Exception] = None
    for attempt in attempts:
        try:
            return attempt()
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Failed to run model forward pass: {last_error}")


def _clone_graph_for_explanation(graph: Any) -> Any:
    """Clone one graph safely so explanation gradients do not mutate the cached inputs."""
    if hasattr(graph, "clone"):
        cloned = graph.clone()
    else:
        cloned = copy.deepcopy(graph)

    if not hasattr(cloned, "x") or cloned.x is None:
        raise ValueError("Graph is missing node features (x), required for explanation.")
    if not hasattr(cloned, "edge_index") or cloned.edge_index is None:
        raise ValueError("Graph is missing edge_index, required for explanation.")

    cloned.x = cloned.x.detach().clone().float().requires_grad_(True)
    if hasattr(cloned, "edge_attr") and cloned.edge_attr is not None:
        cloned.edge_attr = cloned.edge_attr.detach().clone().float().requires_grad_(True)
    return cloned


def _build_roi_importance_payload(roi_scores: np.ndarray) -> List[Dict[str, Any]]:
    """Format per-ROI importance into a stable, frontend-friendly payload."""
    payload: List[Dict[str, Any]] = []
    for idx, score in enumerate(roi_scores):
        payload.append(
            {
                "roi_index": idx + 1,
                "label": _get_roi_label(idx + 1),
                "importance": float(score),
            }
        )
    payload.sort(key=lambda item: item["importance"], reverse=True)
    return payload


def _explain_single_score_model(
    model: Any,
    graphs: List[Any],
    *,
    top_k_edges: int = DEFAULT_XAI_TOP_K_EDGES,
    top_k_windows: int = DEFAULT_XAI_TOP_K_WINDOWS,
) -> Dict[str, Any]:
    """
    Explain one score model with gradient-based importance.

    This implementation is intentionally simple and extensible:
    - it treats the current scalar model output as the attribution target
    - it uses raw gradients of `edge_attr` / `x`
    - it can later be upgraded to Integrated Gradients by swapping the
      per-window attribution computation while keeping the aggregation shape
    - if the model does not expose edge_attr gradients, it falls back to
      node/ROI gradients so inference remains compatible with more models
    """
    if not graphs:
        raise ValueError("No graph windows available for explanation.")

    import torch

    model.eval()

    edge_importance_accumulator: Dict[Tuple[int, int], List[float]] = {}
    roi_window_scores: List[np.ndarray] = []
    window_summaries: List[Dict[str, Any]] = []
    used_edge_gradients = False

    for window_index, raw_graph in enumerate(graphs):
        graph = _clone_graph_for_explanation(raw_graph)

        if getattr(graph, "batch", None) is None and hasattr(graph, "x"):
            graph.batch = torch.zeros(graph.x.shape[0], dtype=torch.long)

        model.zero_grad(set_to_none=True)
        output = _forward_model(model, graph)
        output_tensor = _extract_output_tensor(output)
        scalar_output = output_tensor.mean()
        scalar_output.backward()

        if graph.x.grad is not None:
            node_grad = graph.x.grad.detach().abs().reshape(graph.x.shape[0], -1)
            node_scores = node_grad.mean(dim=1).cpu().numpy()
        else:
            node_scores = np.zeros(int(graph.x.shape[0]), dtype=float)

        roi_scores = node_scores.astype(float, copy=True)
        edge_scores = np.zeros(int(graph.edge_index.shape[1]), dtype=float)
        edge_index = graph.edge_index.detach().cpu().numpy()

        has_edge_gradients = (
            hasattr(graph, "edge_attr")
            and graph.edge_attr is not None
            and graph.edge_attr.grad is not None
        )

        if has_edge_gradients:
            used_edge_gradients = True
            edge_grad = graph.edge_attr.grad.detach().abs().reshape(graph.edge_attr.shape[0], -1)
            edge_scores = edge_grad.mean(dim=1).cpu().numpy()

            for edge_pos, score in enumerate(edge_scores):
                source = int(edge_index[0, edge_pos])
                target = int(edge_index[1, edge_pos])
                roi_scores[source] += float(score)
                roi_scores[target] += float(score)

                edge_key = tuple(sorted((source, target)))
                edge_importance_accumulator.setdefault(edge_key, []).append(float(score))

        roi_window_scores.append(roi_scores)
        window_summaries.append(
            {
                "window_index": window_index,
                "importance": float(np.sum(edge_scores) if has_edge_gradients else np.sum(roi_scores)),
                "prediction": float(scalar_output.detach().cpu().item()),
            }
        )

        model.zero_grad(set_to_none=True)

    aggregated_edges: List[Dict[str, Any]] = []
    for (source, target), scores in edge_importance_accumulator.items():
        mean_score = float(np.mean(scores))
        aggregated_edges.append(
            {
                "source_roi": source + 1,
                "target_roi": target + 1,
                "source_label": _get_roi_label(source + 1),
                "target_label": _get_roi_label(target + 1),
                "importance": mean_score,
                "window_count": len(scores),
            }
        )

    aggregated_edges.sort(key=lambda item: item["importance"], reverse=True)
    top_edges = aggregated_edges[: max(0, int(top_k_edges))]

    mean_roi_scores = np.mean(np.stack(roi_window_scores, axis=0), axis=0)
    roi_importance = _build_roi_importance_payload(mean_roi_scores)

    top_window_payload = sorted(
        window_summaries,
        key=lambda item: item["importance"],
        reverse=True,
    )[: max(0, int(top_k_windows))]

    return {
        "top_edges": top_edges,
        "roi_importance": roi_importance,
        "top_windows": top_window_payload,
        "n_graph_windows": len(window_summaries),
        "method": "gradient_edge_importance" if used_edge_gradients else "gradient_roi_importance",
    }


def _predict_single_score_model(model_or_path: Any, graphs_flat: List[Any]) -> Dict[str, float]:
    """Run model inference over graph windows and aggregate with mean + 95% CI."""
    if not graphs_flat:
        raise ValueError("No graph windows available for inference.")

    import torch

    sample_graph = graphs_flat[0] if graphs_flat else None
    model = _load_score_model(model_or_path, sample_graph=sample_graph) if isinstance(model_or_path, Path) else model_or_path
    if hasattr(model, "eval"):
        model.eval()

    predictions: List[float] = []
    batch_mode_success = False

    try:
        from torch_geometric.loader import DataLoader

        loader = DataLoader(graphs_flat, batch_size=min(16, len(graphs_flat)), shuffle=False)
        with torch.no_grad():
            for batch in loader:
                output = _forward_model(model, batch)
                values = _extract_output_values(output)
                expected = int(getattr(batch, "num_graphs", 1))
                if len(values) == expected:
                    predictions.extend(values)
                elif len(values) == 1 and expected == 1:
                    predictions.extend(values)
                else:
                    predictions = []
                    break
        batch_mode_success = len(predictions) > 0
    except Exception:
        batch_mode_success = False

    if not batch_mode_success:
        predictions = []
        with torch.no_grad():
            for graph in graphs_flat:
                if getattr(graph, "batch", None) is None and hasattr(graph, "x"):
                    graph.batch = torch.zeros(graph.x.shape[0], dtype=torch.long)
                output = _forward_model(model, graph)
                values = _extract_output_values(output)
                if not values:
                    raise ValueError("Model returned empty output for a graph window.")
                predictions.append(float(values[0]))

    if not predictions:
        raise ValueError("Model produced no prediction values.")

    values_arr = np.asarray(predictions, dtype=float)
    mean = float(values_arr.mean())
    if values_arr.size > 1:
        std = float(values_arr.std(ddof=1))
        ci_half = float(1.96 * std / np.sqrt(values_arr.size))
    else:
        ci_half = 0.0

    return {
        "value": mean,
        "ci95_lower": mean - ci_half,
        "ci95_upper": mean + ci_half,
        "n_graph_windows": int(values_arr.size),
    }


def _run_model_predictions(
    graphs_flat: List[Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """Run all configured score models and return predictions, explanations, and errors."""
    settings = get_settings()
    registry = build_model_registry(settings)

    predicted_scores: List[Dict[str, Any]] = []
    explained_scores: List[Dict[str, Any]] = []
    prediction_errors: List[str] = []

    for score_name, model_meta in registry["models"].items():
        score_id = normalize_score_name(score_name)
        print(f"[model] Starting prediction pipeline for score: {score_id}")
        if not model_meta.get("exists"):
            print(f"[model] Skipping {score_id}: model file missing at {model_meta.get('path')}")
            prediction_errors.append(
                f"{score_id}: model file missing ({model_meta.get('filename')})"
            )
            continue

        try:
            sample_graph = graphs_flat[0] if graphs_flat else None
            model = _load_score_model(Path(model_meta["path"]), sample_graph=sample_graph)
            prediction = _predict_single_score_model(model, graphs_flat)
            explanation = _explain_single_score_model(model, graphs_flat)
            predicted_scores.append(
                {
                    "score_id": score_id,
                    "value": prediction["value"],
                    "ci95_lower": prediction["ci95_lower"],
                    "ci95_upper": prediction["ci95_upper"],
                    "n_graph_windows": prediction["n_graph_windows"],
                    "model_file": model_meta.get("filename"),
                    "source": "model",
                }
            )
            explained_scores.append(
                {
                    "score_id": score_id,
                    "model_file": model_meta.get("filename"),
                    "source": "gradient_edge_importance",
                    **explanation,
                }
            )
            print(
                f"[model] Prediction succeeded for {score_id}: "
                f"value={prediction['value']:.4f}, windows={prediction['n_graph_windows']}"
            )
        except Exception as exc:
            print(f"[model] Prediction failed for {score_id}: {exc}")
            prediction_errors.append(f"{score_id}: {exc}")

    return predicted_scores, explained_scores, prediction_errors, registry


def _build_results_payload(
    ts: np.ndarray,
    *,
    file_name: str,
    file_size: int,
) -> Tuple[Dict[str, Any], np.ndarray, Dict[str, Any]]:
    """
    Build analysis payload from a single in-memory timeseries using one correlation computation.
    """
    n_timepoints, n_rois = ts.shape
    corr_matrix = compute_corr(ts, method="pearson")
    heatmap_title = _build_compact_plot_title("ROI Correlation Matrix", file_name, max_file_chars=34)
    connectome_title = _build_compact_plot_title("Top 3 Global Links", file_name, max_file_chars=30)
    marker_title = _build_compact_plot_title("Node strength from top 3 links", file_name, max_file_chars=30)

    plotly_json = create_plotly_heatmap(
        corr_matrix,
        title=heatmap_title,
    )
    nilearn_payload = create_nilearn_connectome_payload(
        corr_matrix,
        top_k=3,
        title=connectome_title,
    )
    markers_payload = create_nilearn_markers_payload(
        corr_matrix,
        top_links=nilearn_payload.get("top_links", []),
        top_k=3,
        title=marker_title,
    )

    predicted_scores: List[Dict[str, Any]] = []
    explained_scores: List[Dict[str, Any]] = []
    prediction_errors: List[str] = []
    graph_windows_count = 0
    graph_meta: Dict[str, Any] = {
        "graph_window_wsize": DEFAULT_WSIZE,
        "graph_window_shift": DEFAULT_SHIFT,
    }

    try:
        graph_payload = _convert_timeseries_to_graph_windows(
            ts,
            wsize=DEFAULT_WSIZE,
            shift=DEFAULT_SHIFT,
            target=0.0,
        )
        graph_windows_count = int(graph_payload["n_windows"])
        graph_meta.update(
            {
                "graph_window_wsize": int(graph_payload["wsize"]),
                "graph_window_shift": int(graph_payload["shift"]),
            }
        )
        predicted_scores, explained_scores, prediction_errors, model_registry = _run_model_predictions(
            graph_payload["graphs_flat"]
        )
    except Exception as exc:
        model_registry = build_model_registry(get_settings())
        prediction_errors = [f"graph-preprocessing: {exc}"]

    results = {
        "n_rois": int(n_rois),
        "n_timepoints": int(n_timepoints),
        "correlation_matrix": corr_matrix.tolist(),
        "plotly_json": plotly_json,
        "file_size": file_size,
        "file_name": file_name,
        "nilearn_connectome_html": nilearn_payload.get("html"),
        "top_links": nilearn_payload.get("top_links", []),
        "top_link_count": int(nilearn_payload.get("top_link_count", 0)),
        "connectome_library": nilearn_payload.get("library"),
        "connectome_coordinates_source": nilearn_payload.get("coordinates_source"),
        "connectome_error": nilearn_payload.get("error"),
        "nilearn_markers_png_base64": markers_payload.get("png_base64"),
        "markers_library": markers_payload.get("library"),
        "markers_view": markers_payload.get("view"),
        "markers_error": markers_payload.get("error"),
        "predicted_scores": predicted_scores,
        "explained_scores": explained_scores,
        "prediction_errors": prediction_errors,
        "graph_window_count": graph_windows_count,
        "model_registry_dir": model_registry.get("model_registry_dir"),
        "model_registry": model_registry.get("models"),
        "time_series": {
            "source": "uploaded_file",
            "default_view": "global_plus_first_5_rois",
            "tr_index": list(range(int(n_timepoints))),
            "global_signal": np.mean(ts, axis=1).astype(float).tolist(),
            "roi_series": [
                {
                    "roi_index": idx + 1,
                    "label": _get_roi_label(idx + 1),
                    "values": ts[:, idx].astype(float).tolist(),
                }
                for idx in range(min(5, int(n_rois)))
            ],
        },
        "pipeline": {
            "correlation_computed_once": True,
            "reused_for_visualization_and_prediction": True,
            "notebook_executed": False,
        },
    }
    results.update(graph_meta)
    return results, corr_matrix, plotly_json


async def _run_single_pass_pipeline(
    file_path: str,
    execution_id: str,
    user_id: str,
    file_name: str,
    file_size: int,
) -> Dict[str, Any]:
    """Run one-pass processing pipeline (corr + graph + prediction) and persist outputs."""
    try:
        await asyncio.sleep(0.5)
        await set_execution_status(execution_id, user_id, "processing")

        ts, preprocess_meta = _load_timeseries_file(file_path, expected_nrois=EXPECTED_NROIS)
        results, corr_matrix, plotly_json = _build_results_payload(
            ts,
            file_name=file_name,
            file_size=file_size,
        )
        results["preprocessing"] = preprocess_meta

        await store_execution_results(execution_id, user_id, results, "completed")

        # Save to Supabase storage (best-effort).
        try:
            from .supabase_service import get_supabase_service
            supabase_service = await get_supabase_service()

            if supabase_service:
                graph_url = await supabase_service.save_correlation_graph(
                    execution_id, user_id, plotly_json, file_name
                )
                matrix_url = await supabase_service.save_correlation_matrix(
                    execution_id, user_id, corr_matrix.tolist(), file_name
                )
                await supabase_service.save_analysis_metadata(
                    execution_id,
                    user_id,
                    {
                        "n_rois": int(results["n_rois"]),
                        "n_timepoints": int(results["n_timepoints"]),
                        "file_name": file_name,
                        "file_size": file_size,
                        "graph_url": graph_url,
                        "matrix_url": matrix_url,
                    }
                )
        except Exception as exc:
            print(f"Supabase save failed (non-critical): {exc}")

        return {"status": "success", "execution_id": execution_id}
    except Exception as exc:
        await store_execution_results(
            execution_id, user_id, {"error": str(exc)}, "failed"
        )
        return {"status": "failed", "error": str(exc)}


async def process_txt_data(file_path: str, execution_id: str, user_id: str, file_name: str, file_size: int) -> Dict[str, Any]:
    """
    Background task to process TXT (ROI time-series), build graph windows,
    and run configured score models.
    """
    return await _run_single_pass_pipeline(
        file_path=file_path,
        execution_id=execution_id,
        user_id=user_id,
        file_name=file_name,
        file_size=file_size,
    )


async def execute_notebook_with_file(
    file_path: str, execution_id: str, user_id: str, file_name: str, file_size: int
) -> Dict[str, Any]:
    """
    Legacy entrypoint retained for API compatibility.
    Runs the same single-pass processing pipeline as `process_txt_data`.
    """
    return await _run_single_pass_pipeline(
        file_path=file_path,
        execution_id=execution_id,
        user_id=user_id,
        file_name=file_name,
        file_size=file_size,
    )


async def store_execution_results(
    execution_id: str, user_id: str, results: Dict[str, Any], status: str
) -> None:
    """Store execution results via Supabase API."""
    await save_execution_results(
        execution_id=execution_id,
        user_id=user_id,
        results=results,
        status=status,
        completed_at=datetime.utcnow(),
    )
