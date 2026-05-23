import asyncio
import json
import math
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from ..core.config import get_settings


class SupabaseDbService:
    """Database access via Supabase API instead of direct Postgres connections."""

    def __init__(self):
        settings = get_settings()
        key = settings.supabase_service_role_key or settings.supabase_key
        if not settings.supabase_url or not key:
            raise RuntimeError("Supabase credentials are not configured for backend DB access.")
        self.client: Client = create_client(settings.supabase_url, key)
        self._client_lock = threading.RLock()
        self._roi_network_map = self._load_roi_network_map()
        self._score_region_cache: Dict[str, List[Dict[str, Any]]] = {}

    async def _run(self, fn):
        def locked_call():
            # The sync Supabase/PostgREST client is shared process-wide here.
            # Guard access so background processing and polling requests do not
            # race each other across worker threads.
            with self._client_lock:
                return fn()

        return await asyncio.to_thread(locked_call)

    @staticmethod
    def _map_execution_status_to_upload_status(status: str) -> str:
        """
        `file_uploads.status` has a different allowed set than `model_executions.status`.
        Preserve queued executions in `model_executions`, but keep uploads at `uploaded`
        until processing actually begins.
        """
        return "uploaded" if status == "queued" else status

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return None
        return numeric if math.isfinite(numeric) else None

    @staticmethod
    def _normalize_json_dict(value: Any) -> Dict[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}

    @staticmethod
    def _normalize_network_name(value: str) -> str:
        compact = "".join(ch.lower() for ch in value if ch.isalnum())
        aliases = {
            "frontoparietal": "Frontoparietal",
            "defaultmode": "Default Mode",
            "medialfrontal": "Medial Frontal",
            "motor": "Motor",
            "visuali": "Visual I",
            "visualii": "Visual II",
            "visualassoc": "Visual Association",
            "visualassociation": "Visual Association",
            "subcorticalcerebellum": "Subcortical/Cerebellum",
        }
        return aliases.get(compact, value)

    @staticmethod
    def _is_dashboard_network_name(value: str) -> bool:
        return value in {
            "Frontoparietal",
            "Default Mode",
            "Medial Frontal",
            "Motor",
            "Visual I",
            "Visual II",
            "Visual Association",
            "Subcortical/Cerebellum",
        }

    def _load_roi_network_map(self) -> Dict[int, str]:
        nodes_path = Path(__file__).resolve().parents[1] / "data" / "brain_importance" / "shen268_nodes.json"
        try:
            payload = json.loads(nodes_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

        nodes = payload.get("nodes") if isinstance(payload, dict) else None
        if not isinstance(nodes, list):
            return {}

        mapping: Dict[int, str] = {}
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_no = node.get("node_no")
            network = node.get("network")
            if isinstance(node_no, int) and isinstance(network, str) and network.strip():
                mapping[node_no] = self._normalize_network_name(network.strip())
        return mapping

    def _get_dashboard_network_label(self, roi_index: Any = None, raw_label: Any = None) -> str:
        if isinstance(roi_index, int):
            mapped = self._roi_network_map.get(roi_index)
            if mapped and self._is_dashboard_network_name(mapped):
                return mapped

        label = self._normalize_network_name(str(raw_label or "").strip())
        return label if self._is_dashboard_network_name(label) else ""

    def _build_dashboard_top_regions(self, explanation: Dict[str, Any]) -> List[Dict[str, Any]]:
        top_edges = explanation.get("top_edges") or []
        if not isinstance(top_edges, list):
            top_edges = []

        region_scores: Dict[str, float] = {}
        for edge in top_edges[:10]:
            if not isinstance(edge, dict):
                continue
            importance = self._safe_float(edge.get("importance"))
            if importance is None:
                continue

            source_label = self._get_dashboard_network_label(
                roi_index=edge.get("source_roi"),
                raw_label=edge.get("source_label"),
            )
            target_label = self._get_dashboard_network_label(
                roi_index=edge.get("target_roi"),
                raw_label=edge.get("target_label"),
            )

            if source_label:
                region_scores[source_label] = region_scores.get(source_label, 0.0) + importance
            if target_label:
                region_scores[target_label] = region_scores.get(target_label, 0.0) + importance

        if region_scores:
            return [
                {"name": name, "importance": score}
                for name, score in sorted(region_scores.items(), key=lambda item: item[1], reverse=True)[:8]
            ]

        roi_items = explanation.get("roi_importance") or []
        if not isinstance(roi_items, list):
            roi_items = []

        fallback_scores: Dict[str, float] = {}
        for roi in roi_items[:10]:
            if not isinstance(roi, dict):
                continue
            importance = self._safe_float(roi.get("importance"))
            if importance is None:
                continue
            label = self._get_dashboard_network_label(
                roi_index=roi.get("roi_index"),
                raw_label=roi.get("label"),
            )
            if label:
                fallback_scores[label] = fallback_scores.get(label, 0.0) + importance

        return [
            {"name": name, "importance": score}
            for name, score in sorted(fallback_scores.items(), key=lambda item: item[1], reverse=True)[:8]
        ]

    def _get_score_fallback_top_regions(self, score_id: str) -> List[Dict[str, Any]]:
        normalized_score_id = str(score_id or "").strip().lower()
        if not normalized_score_id:
            return []

        cached = self._score_region_cache.get(normalized_score_id)
        if cached is not None:
            return [dict(item) for item in cached]

        score_files = {
            "listsort_ageadj": "listsort_fbnetgen_importance_top100.json",
            "pmat": "pmat_gatv2_importance_top100.json",
            "picseq": "picseq_fbnetgen_importance_top100.json",
            "emotsupp_unadj": "emotsupp_reggnn_importance_top100.json",
            "emotsupp_unadj": "emotsupp_reggnn_importance_top100.json",
            "psqi": "psqi_reggnn_importance_top100.json",
        }
        file_name = score_files.get(normalized_score_id)
        if not file_name:
            self._score_region_cache[normalized_score_id] = []
            return []

        payload_path = Path(__file__).resolve().parents[1] / "data" / "brain_importance" / file_name
        try:
            payload = json.loads(payload_path.read_text(encoding="utf-8"))
        except Exception:
            self._score_region_cache[normalized_score_id] = []
            return []

        edges = payload.get("edges") if isinstance(payload, dict) else None
        plot_edges = payload.get("plot_edges") if isinstance(payload, dict) else None
        edge_candidates = plot_edges if isinstance(plot_edges, list) and plot_edges else edges
        if not isinstance(edge_candidates, list):
            self._score_region_cache[normalized_score_id] = []
            return []

        top_k_edges = 15 if normalized_score_id == "pmat" else 30
        region_scores: Dict[str, float] = {}
        for edge in edge_candidates[:top_k_edges]:
            if not isinstance(edge, dict):
                continue
            importance = self._safe_float(edge.get("weight"))
            if importance is None:
                continue
            source_label = self._get_dashboard_network_label(
                roi_index=edge.get("source_node_no"),
                raw_label=edge.get("start_network"),
            )
            target_label = self._get_dashboard_network_label(
                roi_index=edge.get("target_node_no"),
                raw_label=edge.get("end_network"),
            )

            if source_label:
                region_scores[source_label] = region_scores.get(source_label, 0.0) + abs(importance)
            if target_label:
                region_scores[target_label] = region_scores.get(target_label, 0.0) + abs(importance)

        fallback = [
            {"name": name, "importance": score}
            for name, score in sorted(region_scores.items(), key=lambda item: item[1], reverse=True)[:8]
        ]
        self._score_region_cache[normalized_score_id] = fallback
        return [dict(item) for item in fallback]

    def _build_prediction_summary_rows(
        self,
        *,
        execution_id: str,
        upload_id: str,
        user_id: str,
        results: Dict[str, Any],
        completed_at_iso: str,
    ) -> List[Dict[str, Any]]:
        predicted_scores = results.get("predicted_scores") or []
        explained_scores = results.get("explained_scores") or []
        if not isinstance(predicted_scores, list):
            predicted_scores = []
        if not isinstance(explained_scores, list):
            explained_scores = []

        explained_by_score: Dict[str, Dict[str, Any]] = {}
        for explanation in explained_scores:
            if not isinstance(explanation, dict):
                continue
            score_id = str(explanation.get("score_id") or "").strip().lower()
            if score_id:
                explained_by_score[score_id] = explanation

        summary_rows: List[Dict[str, Any]] = []
        for prediction in predicted_scores:
            if not isinstance(prediction, dict):
                continue
            score_id = str(prediction.get("score_id") or "").strip().lower()
            predicted_value = self._safe_float(prediction.get("value"))
            if not score_id or predicted_value is None:
                continue

            explanation = explained_by_score.get(score_id, {})
            top_regions = self._build_dashboard_top_regions(explanation)
            if not top_regions:
                top_regions = self._get_score_fallback_top_regions(score_id)

            summary_rows.append(
                {
                    "execution_id": execution_id,
                    "upload_id": upload_id,
                    "user_id": user_id,
                    "score_id": score_id,
                    "predicted_value": predicted_value,
                    "completed_at": completed_at_iso,
                    "top_regions": top_regions,
                }
            )

        return summary_rows

    async def get_analysis_row(self, execution_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        def op():
            result = (
                self.client.table("model_executions")
                .select("execution_id,upload_id,status,results,completed_at")
                .eq("execution_id", execution_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None

        return await self._run(op)

    async def get_status_row(self, execution_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        def op():
            result = (
                self.client.table("model_executions")
                .select("execution_id,status")
                .eq("execution_id", execution_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None

        return await self._run(op)

    async def get_history_rows(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        def op():
            uploads_resp = (
                self.client.table("file_uploads")
                .select("upload_id,file_name,created_at,status")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            uploads = uploads_resp.data or []
            if not uploads:
                return []

            upload_ids = [row["upload_id"] for row in uploads]
            executions_resp = (
                self.client.table("model_executions")
                .select("upload_id,execution_id,created_at")
                .in_("upload_id", upload_ids)
                .order("created_at", desc=True)
                .execute()
            )
            executions = executions_resp.data or []
            execution_by_upload: Dict[str, str] = {}
            for row in executions:
                upload_id = row.get("upload_id")
                if upload_id and upload_id not in execution_by_upload:
                    execution_by_upload[upload_id] = row.get("execution_id")

            return [
                {
                    "upload_id": row["upload_id"],
                    "file_name": row["file_name"],
                    "uploaded_at": row["created_at"],
                    "status": row["status"],
                    "execution_id": execution_by_upload.get(row["upload_id"]),
                }
                for row in uploads
            ]

        return await self._run(op)

    async def get_upload_file_row(self, upload_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        def op():
            result = (
                self.client.table("file_uploads")
                .select("file_name,file_path")
                .eq("upload_id", upload_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None

        return await self._run(op)

    async def set_execution_status(self, execution_id: str, user_id: str, status: str) -> None:
        def op():
            update_resp = (
                self.client.table("model_executions")
                .update({"status": status})
                .eq("execution_id", execution_id)
                .eq("user_id", user_id)
                .execute()
            )
            upload_id = None
            if update_resp.data:
                upload_id = update_resp.data[0].get("upload_id")
            if not upload_id:
                lookup_resp = (
                    self.client.table("model_executions")
                    .select("upload_id")
                    .eq("execution_id", execution_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if lookup_resp.data:
                    upload_id = lookup_resp.data[0].get("upload_id")
            if upload_id:
                upload_status = self._map_execution_status_to_upload_status(status)
                self.client.table("file_uploads").update({"status": upload_status}).eq("upload_id", upload_id).execute()

        await self._run(op)

    async def save_execution_results(
        self,
        execution_id: str,
        user_id: str,
        results: Dict[str, Any],
        status: str,
        completed_at: datetime,
    ) -> None:
        completed_at_iso = completed_at.isoformat()

        def op():
            update_resp = (
                self.client.table("model_executions")
                .update({"results": results, "status": status, "completed_at": completed_at_iso})
                .eq("execution_id", execution_id)
                .eq("user_id", user_id)
                .execute()
            )
            upload_id = None
            if update_resp.data:
                upload_id = update_resp.data[0].get("upload_id")
            if not upload_id:
                lookup_resp = (
                    self.client.table("model_executions")
                    .select("upload_id")
                    .eq("execution_id", execution_id)
                    .eq("user_id", user_id)
                    .limit(1)
                    .execute()
                )
                if lookup_resp.data:
                    upload_id = lookup_resp.data[0].get("upload_id")
            if upload_id:
                upload_status = self._map_execution_status_to_upload_status(status)
                self.client.table("file_uploads").update({"status": upload_status}).eq("upload_id", upload_id).execute()
                try:
                    summary_rows = self._build_prediction_summary_rows(
                        execution_id=execution_id,
                        upload_id=str(upload_id),
                        user_id=user_id,
                        results=results,
                        completed_at_iso=completed_at_iso,
                    )
                    self.client.table("prediction_summaries").delete().eq("execution_id", execution_id).eq("user_id", user_id).execute()
                    if summary_rows:
                        self.client.table("prediction_summaries").insert(summary_rows).execute()
                except Exception:
                    print("[prediction_summaries] Unable to persist summary rows; continuing without summary table update.")
                    traceback.print_exc()

        await self._run(op)


_db_service: Optional[SupabaseDbService] = None


async def _get_db_service() -> SupabaseDbService:
    global _db_service
    if _db_service is None:
        _db_service = SupabaseDbService()
    return _db_service


async def create_upload_and_execution(
    upload_id: str,
    execution_id: str,
    user_id: str,
    file_name: str,
    file_size: int,
    file_path: str,
    created_at: datetime,
) -> None:
    service = await _get_db_service()
    timestamp = created_at.isoformat()

    def op():
        service.client.table("file_uploads").insert(
            {
                "upload_id": upload_id,
                "user_id": user_id,
                "file_name": file_name,
                "file_size": file_size,
                "file_path": file_path,
                "status": "uploaded",
                "created_at": timestamp,
            }
        ).execute()
        try:
            service.client.table("model_executions").insert(
                {
                    "execution_id": execution_id,
                    "upload_id": upload_id,
                    "user_id": user_id,
                    "status": "queued",
                    "created_at": timestamp,
                }
            ).execute()
        except Exception:
            service.client.table("file_uploads").delete().eq("upload_id", upload_id).execute()
            raise

    await service._run(op)


async def get_analysis_row(execution_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    service = await _get_db_service()
    return await service.get_analysis_row(execution_id, user_id)


async def get_status_row(execution_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    service = await _get_db_service()
    return await service.get_status_row(execution_id, user_id)


async def get_history_rows(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    service = await _get_db_service()
    return await service.get_history_rows(user_id, limit=limit)


async def get_upload_file_row(upload_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    service = await _get_db_service()
    return await service.get_upload_file_row(upload_id, user_id)


async def delete_uploads(upload_ids: List[str], user_id: str) -> List[str]:
    service = await _get_db_service()
    unique_ids = [upload_id for upload_id in dict.fromkeys(upload_ids) if upload_id]
    if not unique_ids:
        return []

    def op():
        uploads_resp = (
            service.client.table("file_uploads")
            .select("upload_id,file_path")
            .eq("user_id", user_id)
            .in_("upload_id", unique_ids)
            .execute()
        )
        uploads = uploads_resp.data or []
        found_ids = [row["upload_id"] for row in uploads if row.get("upload_id")]
        if not found_ids:
            return []

        try:
            service.client.table("prediction_summaries").delete().eq("user_id", user_id).in_("upload_id", found_ids).execute()
        except Exception:
            pass
        service.client.table("model_executions").delete().eq("user_id", user_id).in_("upload_id", found_ids).execute()
        service.client.table("file_uploads").delete().eq("user_id", user_id).in_("upload_id", found_ids).execute()

        for row in uploads:
            file_path = row.get("file_path")
            if not file_path:
                continue
            try:
                from pathlib import Path

                path = Path(file_path)
                if path.exists():
                    path.unlink()
            except Exception:
                continue

        return found_ids

    return await service._run(op)


async def set_execution_status(execution_id: str, user_id: str, status: str) -> None:
    service = await _get_db_service()
    await service.set_execution_status(execution_id, user_id, status)


async def save_execution_results(
    execution_id: str,
    user_id: str,
    results: Dict[str, Any],
    status: str,
    completed_at: datetime,
) -> None:
    service = await _get_db_service()
    await service.save_execution_results(execution_id, user_id, results, status, completed_at)


async def get_execution_for_retry(execution_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    service = await _get_db_service()

    def op():
        exec_resp = (
            service.client.table("model_executions")
            .select("execution_id,upload_id,status")
            .eq("execution_id", execution_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not exec_resp.data:
            return None
        execution = exec_resp.data[0]
        if execution.get("status") != "failed":
            return None
        upload_id = execution.get("upload_id")
        if not upload_id:
            return None
        upload_resp = (
            service.client.table("file_uploads")
            .select("file_name,file_path,file_size")
            .eq("upload_id", upload_id)
            .limit(1)
            .execute()
        )
        if not upload_resp.data:
            return None
        upload = upload_resp.data[0]
        return {**execution, **upload}

    return await service._run(op)


async def get_dashboard_stats(user_id: str) -> Dict[str, Any]:
    service = await _get_db_service()

    def op():
        metric_configs = {
            "listsort_ageadj": {
                "label": "ListSort (Age Adjusted)",
                "shortLabel": "ListSort",
                "range": [50.0, 150.0],
                "defaultInsight": "Working-memory prediction is driven by frontoparietal coordination across the cohort.",
            },
            "pmat": {
                "label": "PMAT (Fluid Intelligence)",
                "shortLabel": "PMAT",
                "range": [0.0, 24.0],
                "defaultInsight": "Fluid reasoning aligns with executive-control and parietal integration patterns.",
            },
            "picseq": {
                "label": "PicSeq (Picture Sequence Memory)",
                "shortLabel": "PicSeq",
                "range": [50.0, 150.0],
                "defaultInsight": "Picture-sequence memory patterns reflect distributed episodic-memory and associative network coordination.",
            },
            "emotsupp_unadj": {
                "label": "EmotSupp (Emotional Support)",
                "shortLabel": "EmotSupp",
                "range": [0.0, 100.0],
                "defaultInsight": "Perceived emotional support reflects default-mode and limbic coordination.",
            },
            "psqi": {
                "label": "PSQI (Sleep Quality)",
                "shortLabel": "PSQI",
                "range": [0.0, 21.0],
                "defaultInsight": "Sleep-quality variation clusters around salience, limbic, and thalamic circuitry.",
            },
        }
        metric_aliases = {
            "sustained_attention": "picseq",
            "emotsupp_unadj": "emotsupp_unadj",
        }

        uploads_resp = (
            service.client.table("file_uploads")
            .select("upload_id,file_name,created_at,status")
            .eq("user_id", user_id)
            .execute()
        )
        uploads = uploads_resp.data or []
        total_uploads = len(uploads)

        exec_resp = (
            service.client.table("model_executions")
            .select("execution_id,upload_id,status,created_at,completed_at,results")
            .eq("user_id", user_id)
            .execute()
        )
        executions = exec_resp.data or []

        completed = [e for e in executions if e.get("status") == "completed"]
        pending = [e for e in executions if e.get("status") in ("queued", "processing")]
        completed_by_execution_id = {
            str(e.get("execution_id")): e
            for e in completed
            if e.get("execution_id")
        }
        completed_execution_ids = [
            str(e.get("execution_id"))
            for e in completed
            if e.get("execution_id")
        ]

        durations = []
        for e in completed:
            created = e.get("created_at")
            finished = e.get("completed_at")
            if created and finished:
                try:
                    from datetime import datetime as dt
                    t0 = dt.fromisoformat(str(created).replace("Z", "+00:00"))
                    t1 = dt.fromisoformat(str(finished).replace("Z", "+00:00"))
                    durations.append((t1 - t0).total_seconds())
                except Exception:
                    pass
        avg_time = sum(durations) / len(durations) if durations else 0.0

        sorted_uploads = sorted(uploads, key=lambda u: str(u.get("created_at") or ""), reverse=True)
        recent = sorted_uploads[:5]

        dashboard_metrics = []
        try:
            summary_rows = []
            if completed_execution_ids:
                summary_resp = (
                    service.client.table("prediction_summaries")
                    .select("execution_id,score_id,predicted_value,completed_at,top_regions")
                    .eq("user_id", user_id)
                    .in_("execution_id", completed_execution_ids)
                    .order("completed_at", desc=False)
                    .execute()
                )
                summary_rows = summary_resp.data or []

            if not summary_rows and completed:
                for execution in completed:
                    execution_id = str(execution.get("execution_id") or "")
                    upload_id = str(execution.get("upload_id") or "")
                    completed_at = str(execution.get("completed_at") or datetime.utcnow().isoformat())
                    results = service._normalize_json_dict(execution.get("results"))
                    if not execution_id or not upload_id:
                        continue
                    summary_rows.extend(
                        service._build_prediction_summary_rows(
                            execution_id=execution_id,
                            upload_id=upload_id,
                            user_id=user_id,
                            results=results,
                            completed_at_iso=completed_at,
                        )
                    )

            execution_region_cache: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
            for execution_id, execution in completed_by_execution_id.items():
                results = service._normalize_json_dict(execution.get("results"))
                explained_scores = results.get("explained_scores") or []
                if not isinstance(explained_scores, list):
                    continue

                per_score_regions: Dict[str, List[Dict[str, Any]]] = {}
                for explanation in explained_scores:
                    if not isinstance(explanation, dict):
                        continue
                    score_id = str(explanation.get("score_id") or "").strip().lower()
                    if not score_id:
                        continue
                    per_score_regions[score_id] = service._build_dashboard_top_regions(explanation)

                if per_score_regions:
                    execution_region_cache[execution_id] = per_score_regions

            metric_values: Dict[str, List[float]] = {metric_id: [] for metric_id in metric_configs}
            metric_timeline: Dict[str, List[tuple[str, float]]] = {metric_id: [] for metric_id in metric_configs}
            metric_region_scores: Dict[str, Dict[str, float]] = {metric_id: {} for metric_id in metric_configs}

            for row in summary_rows:
                if not isinstance(row, dict):
                    continue
                raw_metric_id = str(row.get("score_id") or "").strip().lower()
                metric_id = metric_aliases.get(raw_metric_id, raw_metric_id)
                if metric_id not in metric_configs:
                    continue
                value = service._safe_float(row.get("predicted_value"))
                if value is None:
                    continue
                timeline_key = str(row.get("completed_at") or "")
                metric_values[metric_id].append(value)
                metric_timeline[metric_id].append((timeline_key, value))

                execution_id = str(row.get("execution_id") or "")
                resolved_regions = execution_region_cache.get(execution_id, {}).get(raw_metric_id, [])
                if not resolved_regions:
                    top_regions = row.get("top_regions") or []
                    if not isinstance(top_regions, list):
                        top_regions = []
                    for region in top_regions[:10]:
                        if not isinstance(region, dict):
                            continue
                        label = service._get_dashboard_network_label(raw_label=region.get("name"))
                        importance = service._safe_float(region.get("importance"))
                        if not label or importance is None:
                            continue
                        resolved_regions.append({"name": label, "importance": importance})
                if not resolved_regions:
                    fallback_metric_id = raw_metric_id if raw_metric_id in {"listsort_ageadj", "pmat", "picseq", "emotsupp_unadj", "psqi"} else metric_id
                    resolved_regions = service._get_score_fallback_top_regions(fallback_metric_id)

                for region in resolved_regions:
                    label = str(region.get("name") or "").strip()
                    importance = service._safe_float(region.get("importance"))
                    if not label or importance is None:
                        continue
                    metric_region_scores[metric_id][label] = metric_region_scores[metric_id].get(label, 0.0) + importance

            for metric_id, config in metric_configs.items():
                values = metric_values[metric_id]
                if not values:
                    continue

                ordered_values = [value for _, value in sorted(metric_timeline[metric_id], key=lambda item: item[0])]
                midpoint = max(len(ordered_values) // 2, 1)
                previous_values = ordered_values[:midpoint]
                recent_values = ordered_values[midpoint:] or ordered_values[-1:]
                previous_avg = sum(previous_values) / len(previous_values) if previous_values else ordered_values[0]
                recent_avg = sum(recent_values) / len(recent_values)
                trend = ((recent_avg - previous_avg) / previous_avg * 100.0) if previous_avg else 0.0

                region_items = sorted(
                    metric_region_scores[metric_id].items(),
                    key=lambda item: item[1],
                    reverse=True,
                )[:5]
                max_region_score = region_items[0][1] if region_items else 1.0
                top_regions = [
                    {
                        "name": name,
                        "contribution": round((score / max_region_score) * 100, 1) if max_region_score > 0 else 0.0,
                    }
                    for name, score in region_items
                ]

                confidence = min(0.99, 0.72 + len(values) * 0.03)
                dashboard_metrics.append(
                    {
                        "id": metric_id,
                        "label": config["label"],
                        "shortLabel": config["shortLabel"],
                        "range": config["range"],
                        "average": round(sum(values) / len(values), 3),
                        "trend": round(trend, 3),
                        "distribution": [round(value, 4) for value in sorted(values)],
                        "cohortSplit": [round(previous_avg, 3), round(recent_avg, 3)],
                        "confidence": round(confidence, 3),
                        "reliability": "Observed cohort aggregate" if len(values) >= 3 else "Limited cohort aggregate",
                        "insight": config["defaultInsight"],
                        "topRegions": top_regions,
                        "sampleSize": len(values),
                    }
                )
        except Exception:
            print("[dashboard] prediction_summaries unavailable; returning base dashboard stats only")
            traceback.print_exc()
            dashboard_metrics = []

        return {
            "total_uploads": total_uploads,
            "completed_analyses": len(completed),
            "pending_analyses": len(pending),
            "avg_processing_time": round(avg_time, 1),
            "recent_uploads": recent,
            "dashboard_metrics": dashboard_metrics,
        }

    return await service._run(op)


async def backfill_prediction_summaries(
    user_id: str,
    *,
    batch_size: int = 50,
    max_batches: int = 20,
) -> Dict[str, Any]:
    service = await _get_db_service()

    def op():
        total_rows = 0
        processed_executions = 0
        service.client.table("prediction_summaries").delete().eq("user_id", user_id).execute()

        for batch_index in range(max_batches):
            start = batch_index * batch_size
            end = start + batch_size - 1
            response = (
                service.client.table("model_executions")
                .select("execution_id,upload_id,completed_at,results")
                .eq("user_id", user_id)
                .eq("status", "completed")
                .order("completed_at", desc=False)
                .range(start, end)
                .execute()
            )
            executions = response.data or []
            if not executions:
                break

            rows_to_insert: List[Dict[str, Any]] = []
            for execution in executions:
                execution_id = str(execution.get("execution_id") or "")
                upload_id = str(execution.get("upload_id") or "")
                completed_at = str(execution.get("completed_at") or datetime.utcnow().isoformat())
                results = service._normalize_json_dict(execution.get("results"))
                if not execution_id or not upload_id:
                    continue
                rows_to_insert.extend(
                    service._build_prediction_summary_rows(
                        execution_id=execution_id,
                        upload_id=upload_id,
                        user_id=user_id,
                        results=results,
                        completed_at_iso=completed_at,
                    )
                )
                processed_executions += 1

            if rows_to_insert:
                service.client.table("prediction_summaries").insert(rows_to_insert).execute()
                total_rows += len(rows_to_insert)

            if len(executions) < batch_size:
                break

        return {
            "processed_executions": processed_executions,
            "inserted_summary_rows": total_rows,
        }

    return await service._run(op)


async def init_db() -> None:
    """Initialize DB service (call on startup if needed)."""
    await _get_db_service()
