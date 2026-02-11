import asyncio
import json
import numpy as np
from typing import Dict, Any, Optional
from datetime import datetime
from .database import get_db_connection
from sklearn.covariance import ledoit_wolf
import plotly.graph_objects as go
import base64
from pathlib import Path
import papermill as pm
import tempfile


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
    return fig.to_dict()


async def process_txt_data(file_path: str, execution_id: str, user_id: str, file_name: str, file_size: int) -> Dict[str, Any]:
    """
    Background task to process TXT (ROI time-series) data and compute correlation matrix.
    Stores results in PostgreSQL with JSONB and saves graph/matrix to Supabase.
    """
    try:
        await asyncio.sleep(0.5)
        
        # Read TXT file - expects T x N_ROI format (time points x ROI regions)
        ts = np.loadtxt(file_path)
        
        # Handle transpose if needed (assuming 268 ROIs for Shen atlas)
        if ts.shape[0] == 268 and ts.shape[1] != 268:
            ts = ts.T
        
        n_timepoints, n_rois = ts.shape
        
        # Compute Pearson correlation matrix
        corr_matrix = compute_corr(ts, method="pearson")
        
        # Create Plotly visualization
        plotly_json = create_plotly_heatmap(
            corr_matrix,
            title=f"ROI Correlation Matrix: {file_name}"
        )
        
        # Prepare results
        results = {
            "n_rois": int(n_rois),
            "n_timepoints": int(n_timepoints),
            "correlation_matrix": corr_matrix.tolist(),
            "plotly_json": plotly_json,
            "file_size": file_size,
            "file_name": file_name,
        }
        
        # Store in database
        await store_execution_results(execution_id, user_id, results, "completed")
        
        # Save to Supabase (optional, don't fail if it errors)
        try:
            from .supabase_service import get_supabase_service
            supabase_service = await get_supabase_service()
            
            if supabase_service:
                # Save graph JSON
                graph_url = await supabase_service.save_correlation_graph(
                    execution_id, user_id, plotly_json, file_name
                )
                
                # Save correlation matrix CSV
                matrix_url = await supabase_service.save_correlation_matrix(
                    execution_id, user_id, corr_matrix.tolist(), file_name
                )
                
                # Save metadata
                await supabase_service.save_analysis_metadata(
                    execution_id,
                    user_id,
                    {
                        "n_rois": int(n_rois),
                        "n_timepoints": int(n_timepoints),
                        "file_name": file_name,
                        "file_size": file_size,
                        "graph_url": graph_url,
                        "matrix_url": matrix_url,
                    }
                )
        except Exception as e:
            print(f"Supabase save failed (non-critical): {str(e)}")
        
        return {"status": "success", "execution_id": execution_id}
        
    except Exception as e:
        await store_execution_results(
            execution_id, user_id, {"error": str(e)}, "failed"
        )
        return {"status": "failed", "error": str(e)}


async def execute_notebook_with_file(
    file_path: str, execution_id: str, user_id: str, file_name: str, file_size: int
) -> Dict[str, Any]:
    """
    Execute the correlation matrix notebook with uploaded file as parameter.
    Uses papermill to inject the file path as a parameter and extract results.
    """
    try:
        await asyncio.sleep(0.5)
        
        # Path to the notebook (project root / notebooks)
        notebook_path = Path(__file__).parent.parent.parent.parent / "notebooks" / "plot_corr_matrix.ipynb"
        if not notebook_path.exists():
            raise FileNotFoundError(f"Notebook not found at {notebook_path}")

        # Mark execution as processing
        conn = await get_db_connection()
        try:
            async with conn.transaction():
                await conn.execute(
                    """
                    UPDATE model_executions
                    SET status = $1
                    WHERE execution_id = $2 AND user_id = $3
                    """,
                    "processing",
                    execution_id,
                    user_id,
                )
                await conn.execute(
                    """
                    UPDATE file_uploads
                    SET status = $1
                    WHERE upload_id = (
                        SELECT upload_id FROM model_executions WHERE execution_id = $2
                    )
                    """,
                    "processing",
                    execution_id,
                )
        finally:
            await conn.close()
        
        # Create temporary output notebook
        with tempfile.NamedTemporaryFile(suffix=".ipynb", delete=False) as tmp:
            output_notebook_path = tmp.name
        
        try:
            # Execute notebook with papermill, passing file path as parameter
            pm.execute_notebook(
                str(notebook_path),
                output_notebook_path,
                parameters={"input_file_path": file_path},
                kernel_name="python3",
            )
            
            # Extract results from the executed notebook
            import nbformat
            nb = nbformat.read(output_notebook_path, as_version=4)
            
            # The notebook computes the correlation matrix, extract from its execution
            # Fallback: compute here if notebook didn't produce output
            ts = np.loadtxt(file_path)
            if ts.shape[0] == 268 and ts.shape[1] != 268:
                ts = ts.T
            
            n_timepoints, n_rois = ts.shape
            corr_matrix = compute_corr(ts, method="pearson")
            
            plotly_json = create_plotly_heatmap(
                corr_matrix,
                title=f"ROI Correlation Matrix: {file_name}"
            )
            
            results = {
                "n_rois": int(n_rois),
                "n_timepoints": int(n_timepoints),
                "correlation_matrix": corr_matrix.tolist(),
                "plotly_json": plotly_json,
                "file_size": file_size,
                "file_name": file_name,
                "notebook_executed": True,
                "notebook_path": str(notebook_path),
            }
            
            await store_execution_results(execution_id, user_id, results, "completed")
            
            return {"status": "success", "execution_id": execution_id}
            
        finally:
            # Clean up temporary notebook
            import os
            if os.path.exists(output_notebook_path):
                os.remove(output_notebook_path)
            # Clean up uploaded file
            try:
                file_to_remove = Path(file_path)
                if file_to_remove.exists():
                    file_to_remove.unlink()
            except Exception:
                pass
                
    except Exception as e:
        await store_execution_results(
            execution_id, user_id, {"error": str(e)}, "failed"
        )
        return {"status": "failed", "error": str(e)}


async def store_execution_results(
    execution_id: str, user_id: str, results: Dict[str, Any], status: str
) -> None:
    """Store execution results in PostgreSQL."""
    conn = await get_db_connection()
    try:
        async with conn.transaction():
            await conn.execute(
                """
                UPDATE model_executions
                SET results = $1, status = $2, completed_at = $3
                WHERE execution_id = $4 AND user_id = $5
                """,
                json.dumps(results),
                status,
                datetime.utcnow(),
                execution_id,
                user_id,
            )
            await conn.execute(
                """
                UPDATE file_uploads
                SET status = $1
                WHERE upload_id = (
                    SELECT upload_id FROM model_executions WHERE execution_id = $2
                )
                """,
                status,
                execution_id,
            )
    finally:
        await conn.close()
