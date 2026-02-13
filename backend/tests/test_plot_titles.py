from pathlib import Path
import sys


PROJECT_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_BACKEND_DIR))

from app.services.model_service import _build_compact_plot_title


def test_build_compact_plot_title_truncates_long_filename() -> None:
    title = _build_compact_plot_title(
        "Top 3 Global Links",
        "100610_MOVIE1_7T_AP_shen268_roi_ts_gsr_super_long_file_name.txt",
        max_file_chars=18,
    )

    assert title.startswith("Top 3 Global Links | ")
    assert title.endswith("...")
    assert "100610_MOVIE1_7T_AP_shen268_roi_ts_gsr_super_long_file_name" not in title


def test_build_compact_plot_title_without_filename() -> None:
    title = _build_compact_plot_title("Top 3 Global Links", "")
    assert title == "Top 3 Global Links"
