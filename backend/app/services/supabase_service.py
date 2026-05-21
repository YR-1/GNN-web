import json
import os
from datetime import datetime
from typing import Dict, Any, Optional
from supabase import create_client, Client


class SupabaseService:
    """Service for interacting with Supabase storage and database."""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not configured")
        
        self.client: Client = create_client(supabase_url, supabase_key)
    
    async def save_correlation_graph(
        self,
        execution_id: str,
        user_id: str,
        graph_data: Dict[str, Any],
        file_name: str,
    ) -> Optional[str]:
        """
        Save correlation matrix graph data to Supabase Storage.
        
        Args:
            execution_id: Unique execution identifier
            user_id: User ID
            graph_data: Plotly graph JSON data
            file_name: Original file name
        
        Returns:
            Public URL of saved file or None if failed
        """
        try:
            # Prepare JSON file
            json_content = json.dumps(graph_data, indent=2)
            
            # Create storage path
            path = f"graphs/{user_id}/{execution_id}/correlation_matrix.json"
            
            # Upload to Supabase Storage
            result = self.client.storage.from_("roi-analysis").upload(
                path,
                json_content.encode(),
                {
                    "content-type": "application/json",
                    "metadata": {
                        "execution_id": execution_id,
                        "user_id": user_id,
                        "file_name": file_name,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                }
            )
            
            # Get public URL
            public_url = self.client.storage.from_("roi-analysis").get_public_url(path)
<<<<<<< HEAD
            return public_url["publicURL"] if public_url else None
=======
            return public_url if public_url else None
>>>>>>> origin/main
            
        except Exception as e:
            print(f"Error saving graph to Supabase: {str(e)}")
            return None
    
    async def save_correlation_matrix(
        self,
        execution_id: str,
        user_id: str,
        correlation_matrix: list,
        file_name: str,
    ) -> Optional[str]:
        """
        Save raw correlation matrix as CSV to Supabase Storage.
        
        Args:
            execution_id: Unique execution identifier
            user_id: User ID
            correlation_matrix: 2D list of correlation values
            file_name: Original file name
        
        Returns:
            Public URL of saved file or None if failed
        """
        try:
            # Convert to CSV
            csv_lines = []
            for row in correlation_matrix:
                csv_lines.append("\t".join(str(v) for v in row))
            csv_content = "\n".join(csv_lines)
            
            # Create storage path
            path = f"matrices/{user_id}/{execution_id}/correlation_matrix.csv"
            
            # Upload to Supabase Storage
            result = self.client.storage.from_("roi-analysis").upload(
                path,
                csv_content.encode(),
                {
                    "content-type": "text/csv",
                    "metadata": {
                        "execution_id": execution_id,
                        "user_id": user_id,
                        "file_name": file_name,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                }
            )
            
            # Get public URL
            public_url = self.client.storage.from_("roi-analysis").get_public_url(path)
<<<<<<< HEAD
            return public_url["publicURL"] if public_url else None
=======
            return public_url if public_url else None
>>>>>>> origin/main
            
        except Exception as e:
            print(f"Error saving correlation matrix to Supabase: {str(e)}")
            return None
    
    async def save_analysis_metadata(
        self,
        execution_id: str,
        user_id: str,
        metadata: Dict[str, Any],
    ) -> bool:
        """
        Save analysis metadata to Supabase database.
        
        Args:
            execution_id: Unique execution identifier
            user_id: User ID
            metadata: Analysis metadata dictionary
        
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.client.table("roi_analyses").insert({
                "execution_id": execution_id,
                "user_id": user_id,
                "metadata": metadata,
                "created_at": datetime.utcnow().isoformat(),
            }).execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            print(f"Error saving metadata to Supabase: {str(e)}")
            return False


# Create singleton instance
_supabase_service: Optional[SupabaseService] = None


async def get_supabase_service() -> SupabaseService:
    """Get or create Supabase service instance."""
    global _supabase_service
    if _supabase_service is None:
        try:
            _supabase_service = SupabaseService()
        except ValueError:
            print("Warning: Supabase not configured, graph saving disabled")
            return None
    return _supabase_service
