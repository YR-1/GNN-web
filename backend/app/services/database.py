import asyncio
import json
import math
import threading
import traceback
from datetime import datetime
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
            roi_items = explanation.get("roi_importance") or []
            if not isinstance(roi_items, list):
                roi_items = []

            top_regions = []
            for roi in roi_items[:10]:
                if not isinstance(roi, dict):
                    continue
                label = str(roi.get("label") or roi.get("roi_index") or "").strip()
                importance = self._safe_float(roi.get("importance"))
                if not label or importance is None:
                    continue
                top_regions.append({
                    "name": label,
                    "importance": importance,
                })

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
            "sustained_attention": {
                "label": "Sustained Attention",
                "shortLabel": "Attention",
                "range": [0.0, 1.0],
                "defaultInsight": "Attention performance tracks dorsal attention synchronization stability.",
            },
            "emotion_recognition": {
                "label": "Emotion Recognition",
                "shortLabel": "Emotion",
                "range": [0.0, 100.0],
                "defaultInsight": "Emotion recognition is associated with temporal-limbic and orbitofrontal coordination.",
            },
            "psqi": {
                "label": "PSQI (Sleep Quality)",
                "shortLabel": "PSQI",
                "range": [0.0, 21.0],
                "defaultInsight": "Sleep-quality variation clusters around salience, limbic, and thalamic circuitry.",
            },
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
            .select("execution_id,status,created_at,completed_at")
            .eq("user_id", user_id)
            .execute()
        )
        executions = exec_resp.data or []

        completed = [e for e in executions if e.get("status") == "completed"]
        pending = [e for e in executions if e.get("status") in ("queued", "processing")]

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
            summary_resp = (
                service.client.table("prediction_summaries")
                .select("score_id,predicted_value,completed_at,top_regions")
                .eq("user_id", user_id)
                .order("completed_at", desc=False)
                .execute()
            )
            summary_rows = summary_resp.data or []

            metric_values: Dict[str, List[float]] = {metric_id: [] for metric_id in metric_configs}
            metric_timeline: Dict[str, List[tuple[str, float]]] = {metric_id: [] for metric_id in metric_configs}
            metric_region_scores: Dict[str, Dict[str, float]] = {metric_id: {} for metric_id in metric_configs}

            for row in summary_rows:
                if not isinstance(row, dict):
                    continue
                metric_id = str(row.get("score_id") or "").strip().lower()
                if metric_id not in metric_configs:
                    continue
                value = self._safe_float(row.get("predicted_value"))
                if value is None:
                    continue
                timeline_key = str(row.get("completed_at") or "")
                metric_values[metric_id].append(value)
                metric_timeline[metric_id].append((timeline_key, value))

                top_regions = row.get("top_regions") or []
                if not isinstance(top_regions, list):
                    top_regions = []
                for region in top_regions[:10]:
                    if not isinstance(region, dict):
                        continue
                    label = str(region.get("name") or "").strip()
                    importance = self._safe_float(region.get("importance"))
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
