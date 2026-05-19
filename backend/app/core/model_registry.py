from pathlib import Path
import re
from typing import Dict, List

from .config import Settings


DEFAULT_SCORE_MODELS = [
    "listsort_ageadj",
    "psqi",
    "emotsupp_unadj",
    "picseq",
    "pmat",
]


def normalize_score_name(score_name: str) -> str:
    """Normalize score names so they map predictably to model filenames."""
    normalized = re.sub(r"[^a-z0-9]+", "_", score_name.strip().lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    if not normalized:
        raise ValueError("Score name cannot be empty after normalization.")
    return normalized


def parse_score_model_names(csv_value: str) -> List[str]:
    names: List[str] = []
    for raw in csv_value.split(","):
        stripped = raw.strip()
        if not stripped:
            continue
        normalized = normalize_score_name(stripped)
        if normalized not in names:
            names.append(normalized)
    return names or DEFAULT_SCORE_MODELS.copy()


def resolve_model_registry_dir(settings: Settings) -> Path:
    base = Path(settings.model_registry_dir)
    if base.is_absolute():
        return base
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / base).resolve()


def ensure_model_registry_dir(settings: Settings) -> Path:
    directory = resolve_model_registry_dir(settings)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def resolve_model_path(settings: Settings, score_name: str) -> Path:
    score_key = normalize_score_name(score_name)
    return resolve_model_registry_dir(settings) / f"{score_key}.pt"


def resolve_target_scaler_json_path(settings: Settings, score_name: str) -> Path:
    score_key = normalize_score_name(score_name)
    return resolve_model_registry_dir(settings) / "scalers" / f"{score_key}_target_scaler.json"


def resolve_target_scaler_joblib_path(settings: Settings, score_name: str) -> Path:
    score_key = normalize_score_name(score_name)
    return resolve_model_registry_dir(settings) / "scalers" / f"{score_key}_target_scaler.joblib"


def build_model_registry(settings: Settings) -> Dict[str, object]:
    """
    Build score->model path mapping from env configuration.
    Each score expects a model file named <normalized_score>.pt in MODEL_REGISTRY_DIR.
    """
    registry_dir = resolve_model_registry_dir(settings)
    score_names = parse_score_model_names(settings.model_registry_scores)

    models: Dict[str, Dict[str, object]] = {}
    for score_name in score_names:
        path = resolve_model_path(settings, score_name)
        scaler_json_path = resolve_target_scaler_json_path(settings, score_name)
        scaler_joblib_path = resolve_target_scaler_joblib_path(settings, score_name)
        models[score_name] = {
            "filename": path.name,
            "path": str(path),
            "exists": path.exists(),
            "target_scaler_json": str(scaler_json_path),
            "target_scaler_json_exists": scaler_json_path.exists(),
            "target_scaler_joblib": str(scaler_joblib_path),
            "target_scaler_joblib_exists": scaler_joblib_path.exists(),
        }

    return {
        "model_registry_dir": str(registry_dir),
        "models": models,
    }
