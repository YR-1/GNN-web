#!/usr/bin/env python
"""Build cached global ListSort FBNetGen brain importance visualisations."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import plotly.graph_objects as go


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_NODES_JSON = ROOT / "app" / "data" / "brain_importance" / "shen268_nodes.json"
DEFAULT_IMPORTANCE_JSON = ROOT / "app" / "data" / "brain_importance" / "listsort_fbnetgen_importance_top100.json"
DEFAULT_OUTPUT = ROOT / "static" / "brain_plots" / "listsort_importance_3d.html"
DEFAULT_STATIC_OUTPUT = ROOT / "static" / "brain_plots" / "listsort_importance_4panel.png"

TOP_K_3D_NODES = 15
TOP_K_3D_EDGES = 30
TOP_K_STATIC_NODES = TOP_K_3D_NODES
TOP_K_STATIC_EDGES = TOP_K_3D_EDGES
NODE_INTENSITY_COLORSCALE = [
    [0.0, "#eeeeee"],
    [0.35, "#fff2a8"],
    [0.7, "#ffd84d"],
    [1.0, "#f2a900"],
]
NODE_INTENSITY_COLORS = [color for _, color in NODE_INTENSITY_COLORSCALE]
BRAIN_SURFACE_OPACITY = 0.16
WITHIN_EDGE_COLOR = "#2a78c4"
BETWEEN_EDGE_COLOR = "#d4552d"
EDGE_LABELS = {
    "between-category": "Across categories",
    "within-category": "Within category",
}


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _norm(values: Iterable[float], low: float, high: float) -> np.ndarray:
    arr = np.asarray(list(values), dtype=float)
    if arr.size == 0:
        return arr
    mn = float(np.nanmin(arr))
    mx = float(np.nanmax(arr))
    if not np.isfinite(mn) or not np.isfinite(mx) or abs(mx - mn) < 1e-12:
        return np.full_like(arr, (low + high) / 2, dtype=float)
    return low + (arr - mn) * (high - low) / (mx - mn)


def _clean_category(value: Any) -> str:
    if value is None:
        return "Unknown"
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return "Unknown"
    return text


def _build_hover(node: dict[str, Any]) -> str:
    parts = [
        f"ROI {int(node['node_no'])}",
        f"Category: {node['_category']}",
        f"roi_index={int(node['id'])}",
        f"consensus_z={float(node['score']):.4f}",
        f"consensus_z_norm01={float(node['score_norm']):.4f}",
        f"relative_top_node_importance={float(node['_node_color01_local']):.4f}",
    ]
    for key in ("roi_label", "region_name", "region_detail", "hemisphere", "lobe"):
        value = node.get(key)
        if value is not None and str(value).strip():
            parts.append(f"{key}: {value}")
    return "<br>".join(parts)


def _edge_source(edge: dict[str, Any]) -> int:
    return int(edge.get("source", edge.get("roi_src")))


def _edge_target(edge: dict[str, Any]) -> int:
    return int(edge.get("target", edge.get("roi_dst")))


def _edge_weight(edge: dict[str, Any]) -> float:
    return float(edge.get("weight", edge.get("edge_grad", edge.get("_edge_score", 0.0))))


def _normalise_edge_type(edge: dict[str, Any], source_category: str, target_category: str) -> str:
    edge_type = str(edge.get("edge_type", "")).strip().lower()
    if edge_type in {"within", "within-category"}:
        return "within-category"
    if edge_type in {"between", "between-category", "across", "across-category"}:
        return "between-category"
    return "within-category" if source_category == target_category else "between-category"


def build_figure(nodes_json: Path, importance_json: Path) -> go.Figure:
    nodes_payload = _load_json(nodes_json)
    importance_payload = _load_json(importance_json)

    atlas_nodes = {int(node["id"]): node for node in nodes_payload["nodes"]}
    importance_nodes = []
    for item in importance_payload["nodes"]:
        roi_id = int(item["id"])
        atlas = atlas_nodes[roi_id]
        merged = {
            **atlas,
            "score": float(item["score"]),
            "score_norm": float(item["score_norm"]),
        }
        merged["_category"] = _clean_category(merged.get("network"))
        merged["_node_magnitude"] = abs(float(merged["score"]))
        importance_nodes.append(merged)

    importance_nodes.sort(key=lambda node: int(node["id"]))
    node_sizes = _norm((node["_node_magnitude"] for node in importance_nodes), 7, 24)
    for node, size in zip(importance_nodes, node_sizes):
        node["_node_size"] = float(size)

    top_nodes = sorted(importance_nodes, key=lambda node: float(node["score"]), reverse=True)[:TOP_K_3D_NODES]
    shown_rois = {int(node["id"]) for node in top_nodes}
    categories = sorted({_clean_category(node["_category"]) for node in top_nodes})

    color_min = min(float(node["score"]) for node in top_nodes)
    color_max = max(float(node["score"]) for node in top_nodes)
    for node in top_nodes:
        if abs(color_max - color_min) < 1e-12:
            node["_node_color01_local"] = 0.5
        else:
            node["_node_color01_local"] = (float(node["score"]) - color_min) / (color_max - color_min)

    dedicated_edge_key = next(
        (key for key in ("plot_edges", "edges_3d", "edges_among_top_nodes") if importance_payload.get(key)),
        None,
    )
    edge_candidates = importance_payload.get(dedicated_edge_key or "edges", [])
    has_dedicated_plot_edges = dedicated_edge_key is not None
    edge_source_label = "dedicated 3D plot edges" if has_dedicated_plot_edges else "top overall edges"

    edge_plot = []
    using_overall_edge_fallback = False
    for edge in edge_candidates:
        source = _edge_source(edge)
        target = _edge_target(edge)
        if has_dedicated_plot_edges or (source in shown_rois and target in shown_rois):
            edge_plot.append({**edge, "_source": source, "_target": target, "_edge_score": _edge_weight(edge)})

    if not edge_plot:
        using_overall_edge_fallback = True
        edge_plot = [
            {**edge, "_source": _edge_source(edge), "_target": _edge_target(edge), "_edge_score": _edge_weight(edge)}
            for edge in importance_payload.get("edges", [])
        ]

    edge_plot = sorted(edge_plot, key=lambda edge: float(edge["_edge_score"]), reverse=True)[:TOP_K_3D_EDGES]
    edge_widths = _norm((abs(float(edge["_edge_score"])) for edge in edge_plot), 1.2, 9.0)
    for edge, width in zip(edge_plot, edge_widths):
        source_node = atlas_nodes[int(edge["_source"])]
        target_node = atlas_nodes[int(edge["_target"])]
        edge["_edge_width"] = float(width)
        edge["_src_cat"] = _clean_category(source_node.get("network"))
        edge["_dst_cat"] = _clean_category(target_node.get("network"))
        edge["_edge_type"] = _normalise_edge_type(edge, edge["_src_cat"], edge["_dst_cat"])

    edge_endpoint_nodes = []
    if using_overall_edge_fallback:
        endpoint_ids = sorted({int(edge["_source"]) for edge in edge_plot} | {int(edge["_target"]) for edge in edge_plot})
        edge_endpoint_nodes = [atlas_nodes[roi_id] for roi_id in endpoint_ids if roi_id not in shown_rois]

    traces: list[Any] = []
    trace_filters: list[dict[str, Any]] = []

    try:
        from nilearn import datasets, surface

        fsaverage = datasets.fetch_surf_fsaverage(mesh="fsaverage5")
        for hemi, surf_path in (("left", fsaverage.pial_left), ("right", fsaverage.pial_right)):
            coords, faces = surface.load_surf_mesh(surf_path)
            traces.append(
                go.Mesh3d(
                    x=coords[:, 0],
                    y=coords[:, 1],
                    z=coords[:, 2],
                    i=faces[:, 0],
                    j=faces[:, 1],
                    k=faces[:, 2],
                    color="#d8d2c4",
                    opacity=BRAIN_SURFACE_OPACITY,
                    name=f"{hemi} cortical surface",
                    hoverinfo="skip",
                    showscale=False,
                    lighting=dict(ambient=0.55, diffuse=0.65, specular=0.12, roughness=0.8),
                    lightposition=dict(x=0, y=-120, z=120),
                    showlegend=False,
                )
            )
            trace_filters.append({"kind": "brain", "cats": set(categories)})
    except Exception as exc:
        print(f"Could not render cortical surface ({type(exc).__name__}: {exc}). Continuing with nodes/edges only.")

    for category in categories:
        sub = [node for node in top_nodes if node["_category"] == category]
        traces.append(
            go.Scatter3d(
                x=[node["x"] for node in sub],
                y=[node["y"] for node in sub],
                z=[node["z"] for node in sub],
                mode="markers+text",
                text=[str(int(node["node_no"])) for node in sub],
                textposition="top center",
                hovertext=[_build_hover(node) for node in sub],
                hoverinfo="text",
                marker=dict(
                    size=[node["_node_size"] for node in sub],
                    color=[node["_node_color01_local"] for node in sub],
                    cmin=0.0,
                    cmax=1.0,
                    colorscale=NODE_INTENSITY_COLORSCALE,
                    colorbar=dict(
                        title="Node<br>importance",
                        tickmode="array",
                        tickvals=[0, 0.5, 1],
                        ticktext=["Lower", "Mid", "Higher"],
                    ),
                    showscale=not any(trace_filter.get("kind") == "node" for trace_filter in trace_filters),
                    opacity=0.94,
                    line=dict(width=1, color="black"),
                ),
                name=f"Nodes: {category}",
                showlegend=False,
            )
        )
        trace_filters.append({"kind": "node", "cats": {category}})

    if edge_endpoint_nodes:
        traces.append(
            go.Scatter3d(
                x=[node["x"] for node in edge_endpoint_nodes],
                y=[node["y"] for node in edge_endpoint_nodes],
                z=[node["z"] for node in edge_endpoint_nodes],
                mode="markers",
                hovertext=[
                    "<br>".join(
                        [
                            f"ROI {int(node['node_no'])}",
                            "Shown because top edges do not connect the top-15 nodes",
                            f"Category: {_clean_category(node.get('network'))}",
                            f"roi_index={int(node['id'])}",
                            f"roi_label: {node.get('roi_label', '')}",
                        ]
                    )
                    for node in edge_endpoint_nodes
                ],
                hoverinfo="text",
                marker=dict(size=5, color="#64748b", opacity=0.42, line=dict(width=0.5, color="#334155")),
                name="Edge endpoint ROIs",
                showlegend=False,
            )
        )
        trace_filters.append({"kind": "edge-endpoint", "cats": set(categories)})

    edge_type_seen: set[str] = set()
    for edge in edge_plot:
        source = atlas_nodes[int(edge["_source"])]
        target = atlas_nodes[int(edge["_target"])]
        edge_type = edge["_edge_type"]
        edge_label = EDGE_LABELS.get(edge_type, edge_type.replace("-", " ").title())
        color = WITHIN_EDGE_COLOR if edge_type == "within-category" else BETWEEN_EDGE_COLOR
        hover = "<br>".join(
            [
                f"ROI {int(source['node_no'])} -> ROI {int(target['node_no'])}",
                f"Edge relationship: {edge_label}",
                f"Source category: {edge['_src_cat']}",
                f"Destination category: {edge['_dst_cat']}",
                f"edge_grad: {float(edge['_edge_score']):.6g}",
            ]
        )
        traces.append(
            go.Scatter3d(
                x=[source["x"], target["x"]],
                y=[source["y"], target["y"]],
                z=[source["z"], target["z"]],
                mode="lines",
                line=dict(color=color, width=float(edge["_edge_width"])),
                opacity=0.72,
                hovertext=hover,
                hoverinfo="text",
                name=edge_label,
                legendgroup=edge_type,
                showlegend=edge_type not in edge_type_seen,
            )
        )
        edge_type_seen.add(edge_type)
        trace_filters.append({"kind": "edge", "cats": {edge["_src_cat"], edge["_dst_cat"]}})

    buttons = [dict(label="All categories", method="update", args=[{"visible": [True] * len(traces)}])]
    for category in categories:
        visible = []
        for trace_filter in trace_filters:
            if trace_filter["kind"] == "brain":
                visible.append(True)
            else:
                visible.append(category in trace_filter["cats"])
        buttons.append(dict(label=category, method="update", args=[{"visible": visible}]))

    fig = go.Figure(data=traces)
    fig.update_layout(
        title=(
            f"3D brain surface with Shen-268 importance graph: top {TOP_K_3D_NODES} nodes, top {len(edge_plot)} edges"
            + f" from {edge_source_label}"
            + (" (top-edge endpoints shown faintly)" if edge_endpoint_nodes else "")
        ),
        scene=dict(
            xaxis=dict(visible=False, showbackground=False, showgrid=False, zeroline=False, showticklabels=False, title=""),
            yaxis=dict(visible=False, showbackground=False, showgrid=False, zeroline=False, showticklabels=False, title=""),
            zaxis=dict(visible=False, showbackground=False, showgrid=False, zeroline=False, showticklabels=False, title=""),
            bgcolor="rgba(0,0,0,0)",
            aspectmode="data",
            camera=dict(eye=dict(x=1.7, y=1.7, z=1.25)),
        ),
        updatemenus=[dict(buttons=buttons, direction="down", x=0.01, y=0.98, xanchor="left", yanchor="top")],
        legend=dict(x=0.01, y=0.82),
        margin=dict(l=0, r=0, t=58, b=0),
        height=820,
    )
    return fig


def _prepare_static_plot_data(nodes_json: Path, importance_json: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    nodes_payload = _load_json(nodes_json)
    importance_payload = _load_json(importance_json)
    atlas_nodes = {int(node["id"]): node for node in nodes_payload["nodes"]}

    importance_nodes = []
    for item in importance_payload["nodes"]:
        roi_id = int(item["id"])
        atlas = atlas_nodes[roi_id]
        merged = {
            **atlas,
            "score": float(item["score"]),
            "score_norm": float(item["score_norm"]),
        }
        merged["_category"] = _clean_category(merged.get("network"))
        merged["_node_magnitude"] = abs(float(merged["score"]))
        importance_nodes.append(merged)

    importance_nodes.sort(key=lambda node: int(node["id"]))
    node_sizes = _norm((node["_node_magnitude"] for node in importance_nodes), 30, 220)
    for node, size in zip(importance_nodes, node_sizes):
        node["_node_size"] = float(size)

    top_nodes = sorted(importance_nodes, key=lambda node: float(node["score"]), reverse=True)[:TOP_K_STATIC_NODES]
    color_min = min(float(node["score"]) for node in top_nodes)
    color_max = max(float(node["score"]) for node in top_nodes)
    for node in top_nodes:
        if abs(color_max - color_min) < 1e-12:
            node["_node_color01_local"] = 0.5
        else:
            node["_node_color01_local"] = (float(node["score"]) - color_min) / (color_max - color_min)

    dedicated_edge_key = next(
        (key for key in ("plot_edges", "edges_3d", "edges_among_top_nodes") if importance_payload.get(key)),
        None,
    )
    edge_candidates = importance_payload.get(dedicated_edge_key or "edges", [])
    shown_rois = {int(node["id"]) for node in top_nodes}
    edge_plot = []

    for edge in edge_candidates:
        source = _edge_source(edge)
        target = _edge_target(edge)
        if dedicated_edge_key or (source in shown_rois and target in shown_rois):
            edge_plot.append({**edge, "_source": source, "_target": target, "_edge_score": _edge_weight(edge)})

    if not edge_plot:
        edge_plot = [
            {**edge, "_source": _edge_source(edge), "_target": _edge_target(edge), "_edge_score": _edge_weight(edge)}
            for edge in importance_payload.get("edges", [])
        ]

    edge_plot = sorted(edge_plot, key=lambda edge: float(edge["_edge_score"]), reverse=True)[:TOP_K_STATIC_EDGES]
    for edge in edge_plot:
        source_node = atlas_nodes[int(edge["_source"])]
        target_node = atlas_nodes[int(edge["_target"])]
        edge["_src_cat"] = _clean_category(source_node.get("network"))
        edge["_dst_cat"] = _clean_category(target_node.get("network"))
        edge["_edge_type"] = _normalise_edge_type(edge, edge["_src_cat"], edge["_dst_cat"])

    return top_nodes, edge_plot, len(importance_nodes)


def build_static_4panel_png(nodes_json: Path, importance_json: Path, output: Path) -> None:
    """Render the 4-panel anatomical ListSort importance PNG used by the website."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LinearSegmentedColormap, to_hex
    from matplotlib.lines import Line2D
    from nilearn import plotting

    top_nodes, edge_plot, n_nodes = _prepare_static_plot_data(nodes_json, importance_json)
    centroids = np.asarray([[node["x"], node["y"], node["z"]] for node in sorted(top_nodes, key=lambda n: int(n["id"]))])
    all_nodes_payload = _load_json(nodes_json)["nodes"]
    all_centroids = np.asarray(
        [[node["x"], node["y"], node["z"]] for node in sorted(all_nodes_payload, key=lambda n: int(n["id"]))],
        dtype=float,
    )

    node_cmap = LinearSegmentedColormap.from_list("fbnetgen_node_gold", NODE_INTENSITY_COLORS)
    within_cmap = LinearSegmentedColormap.from_list("within_category_edge", [WITHIN_EDGE_COLOR, WITHIN_EDGE_COLOR])
    between_cmap = LinearSegmentedColormap.from_list("between_category_edge", [BETWEEN_EDGE_COLOR, BETWEEN_EDGE_COLOR])

    def adjacency_for(edge_type: str) -> np.ndarray:
        adj = np.zeros((n_nodes, n_nodes), dtype=float)
        for edge in edge_plot:
            if edge["_edge_type"] != edge_type:
                continue
            source = int(edge["_source"])
            target = int(edge["_target"])
            weight = float(edge["_edge_score"])
            adj[source, target] = weight
            adj[target, source] = weight
        return adj

    between_adj = adjacency_for("between-category")
    within_adj = adjacency_for("within-category")
    has_between = bool(np.any(between_adj))
    has_within = bool(np.any(within_adj))

    fig = plt.figure(figsize=(20, 7.2), facecolor="white")
    display = None

    if has_between:
        display = plotting.plot_connectome(
            adjacency_matrix=between_adj,
            node_coords=all_centroids,
            node_size=0,
            edge_threshold=None,
            edge_cmap=between_cmap,
            edge_kwargs={"linewidth": 1.7, "alpha": 0.72},
            display_mode="lyrz",
            colorbar=False,
            title=f"ListSort FBNetGen importance: top {len(top_nodes)} nodes, top {len(edge_plot)} edges",
            figure=fig,
            axes=(0.02, 0.08, 0.84, 0.84),
        )

    if has_within:
        if display is None:
            display = plotting.plot_connectome(
                adjacency_matrix=within_adj,
                node_coords=all_centroids,
                node_size=0,
                edge_threshold=None,
                edge_cmap=within_cmap,
                edge_kwargs={"linewidth": 1.7, "alpha": 0.72},
                display_mode="lyrz",
                colorbar=False,
                title=f"ListSort FBNetGen importance: top {len(top_nodes)} nodes, top {len(edge_plot)} edges",
                figure=fig,
                axes=(0.02, 0.08, 0.84, 0.84),
            )
        else:
            display.add_graph(
                within_adj,
                all_centroids,
                node_size=0,
                edge_threshold=None,
                edge_cmap=within_cmap,
                edge_kwargs={"linewidth": 1.7, "alpha": 0.72},
                colorbar=False,
            )

    if display is None:
        display = plotting.plot_connectome(
            adjacency_matrix=np.zeros((n_nodes, n_nodes), dtype=float),
            node_coords=all_centroids,
            node_size=0,
            display_mode="lyrz",
            colorbar=False,
            title=f"ListSort FBNetGen importance: top {len(top_nodes)} nodes",
            figure=fig,
            axes=(0.02, 0.08, 0.84, 0.84),
        )

    display.add_markers(
        marker_coords=centroids,
        marker_color=[to_hex(node_cmap(float(node["_node_color01_local"]))) for node in sorted(top_nodes, key=lambda n: int(n["id"]))],
        marker_size=[float(node["_node_size"]) for node in sorted(top_nodes, key=lambda n: int(n["id"]))],
    )

    colorbar_ax = fig.add_axes([0.905, 0.28, 0.014, 0.42])
    scalar_mappable = plt.cm.ScalarMappable(cmap=node_cmap, norm=plt.Normalize(vmin=0, vmax=1))
    scalar_mappable.set_array([])
    colorbar = fig.colorbar(scalar_mappable, cax=colorbar_ax)
    colorbar.set_label("Node importance", labelpad=10)
    colorbar.set_ticks([0, 0.5, 1])
    colorbar.set_ticklabels(["Lower", "Mid", "Higher"])
    colorbar.ax.tick_params(labelsize=9, pad=2)

    legend_items = [
        Line2D([0], [0], color=BETWEEN_EDGE_COLOR, lw=3, label="Across categories"),
        Line2D([0], [0], color=WITHIN_EDGE_COLOR, lw=3, label="Within category"),
    ]
    fig.legend(
        handles=legend_items,
        loc="lower right",
        bbox_to_anchor=(0.965, 0.11),
        frameon=False,
        fontsize=10,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nodes-json", type=Path, default=DEFAULT_NODES_JSON)
    parser.add_argument("--importance-json", type=Path, default=DEFAULT_IMPORTANCE_JSON)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--static-output", type=Path, default=DEFAULT_STATIC_OUTPUT)
    parser.add_argument(
        "--include-plotlyjs",
        default="cdn",
        choices=["cdn", "directory", "inline", "false"],
        help="How Plotly JS is included in the HTML. Use 'cdn' for compact deployable output.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    fig = build_figure(args.nodes_json, args.importance_json)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    include_plotlyjs: str | bool
    if args.include_plotlyjs == "inline":
        include_plotlyjs = True
    elif args.include_plotlyjs == "false":
        include_plotlyjs = False
    else:
        include_plotlyjs = args.include_plotlyjs
    fig.write_html(str(args.output), include_plotlyjs=include_plotlyjs)
    print(f"Saved cached ListSort importance brain: {args.output}")
    build_static_4panel_png(args.nodes_json, args.importance_json, args.static_output)
    print(f"Saved cached ListSort static 4-panel brain: {args.static_output}")


if __name__ == "__main__":
    main()
