import asyncio
import threading
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
        uploads_resp = (
            service.client.table("file_uploads")
            .select("upload_id,created_at,status")
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

        # Average processing time for completed executions
        durations = []
        for e in completed:
            created = e.get("created_at")
            finished = e.get("completed_at")
            if created and finished:
                try:
                    from datetime import datetime as dt
                    t0 = dt.fromisoformat(created.replace("Z", "+00:00"))
                    t1 = dt.fromisoformat(finished.replace("Z", "+00:00"))
                    durations.append((t1 - t0).total_seconds())
                except Exception:
                    pass
        avg_time = sum(durations) / len(durations) if durations else 0.0

        # Recent activity (last 5)
        sorted_uploads = sorted(uploads, key=lambda u: u.get("created_at", ""), reverse=True)
        recent = sorted_uploads[:5]

        return {
            "total_uploads": total_uploads,
            "completed_analyses": len(completed),
            "pending_analyses": len(pending),
            "avg_processing_time": round(avg_time, 1),
            "recent_uploads": recent,
        }

    return await service._run(op)


async def init_db() -> None:
    """Initialize DB service (call on startup if needed)."""
    await _get_db_service()
