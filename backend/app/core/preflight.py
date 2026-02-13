import importlib.util
from typing import Iterable, List, Tuple


REQUIRED_MODULES: List[Tuple[str, str]] = [
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("python-multipart", "multipart"),
    ("python-jose", "jose"),
    ("pydantic", "pydantic"),
    ("pydantic-settings", "pydantic_settings"),
    ("pandas", "pandas"),
    ("scikit-learn", "sklearn"),
    ("numpy", "numpy"),
    ("supabase", "supabase"),
    ("python-dotenv", "dotenv"),
    ("httpx", "httpx"),
    ("psycopg2-binary", "psycopg2"),
    ("sqlalchemy", "sqlalchemy"),
    ("matplotlib", "matplotlib"),
    ("plotly", "plotly"),
    ("papermill", "papermill"),
    ("jupyter", "jupyter"),
    ("nbformat", "nbformat"),
    ("nilearn", "nilearn"),
    ("dill", "dill"),
    ("torch", "torch"),
    ("torch-geometric", "torch_geometric"),
]


def _find_missing_modules(required_modules: Iterable[Tuple[str, str]]) -> List[Tuple[str, str]]:
    missing: List[Tuple[str, str]] = []
    for package_name, import_name in required_modules:
        if importlib.util.find_spec(import_name) is None:
            missing.append((package_name, import_name))
    return missing


def run_dependency_preflight(strict: bool = False) -> List[Tuple[str, str]]:
    """
    Print backend dependency status and return missing package/import pairs.

    When strict=True, raises RuntimeError if required modules are missing.
    """
    print("[Dependency Check] Verifying required backend Python modules...")
    missing = _find_missing_modules(REQUIRED_MODULES)

    if not missing:
        print("[Dependency Check] OK: all required modules are installed.")
        return []

    print("[Dependency Check] Missing modules detected:")
    for package_name, import_name in missing:
        print(f"  - {package_name} (import '{import_name}')")
    print("[Dependency Check] Install with:")
    print(f"  pip install {' '.join(package_name for package_name, _ in missing)}")

    if strict:
        raise RuntimeError(
            "Missing required backend modules: "
            + ", ".join(package_name for package_name, _ in missing)
        )

    return missing


if __name__ == "__main__":
    missing_modules = run_dependency_preflight(strict=False)
    raise SystemExit(1 if missing_modules else 0)
