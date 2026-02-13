# Change Tracking

## 2026-02-11
- Standardized frontend Supabase key usage to `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/lib/supabase.ts`.
- Removed legacy frontend key fallback `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- Added explicit error message when required frontend Supabase env vars are missing.
- Removed unused `useEffect` imports in `frontend/app/(auth)/login/page.tsx` and `frontend/app/(auth)/signup/page.tsx`.
- Added `react-plotly.js` local type declaration in `frontend/lib/react-plotly-js.d.ts`.
- Switched frontend env var name back to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` by request.
- Refactored backend data access from direct Postgres (`DATABASE_URL`/`asyncpg`) to Supabase table API.
- Added backend support for `SUPABASE_SERVICE_ROLE_KEY` (with fallback to `SUPABASE_KEY`).
- Updated backend docs and requirements to remove `asyncpg` and direct DB URL requirement.
- Changed backend token validation to return `401` on missing/invalid auth instead of using `sub="anonymous"` (prevents UUID insert failures).
- Fixed backend token parsing for Supabase JWTs by disabling audience validation during unverified decode (`verify_aud=False`).
- Added Papermill `parameters` tag to the notebook `input_file_path` cell to prevent unknown-parameter warnings.
- Fixed upload flow to return and use `execution_id` (instead of falling back to `upload_id`) for `/api/analysis` polling.

## 2026-02-12
- Added `frontend/lib/score-registry.ts` with 4 score definitions (`PMAT`, `Sustained Attention`, `Emotion Recognition`, `Sleep Quality`) across 2 categories and ROI assignment metadata.
- Added deterministic prediction simulation in `frontend/lib/score-simulator.ts`, including `value`, `ci95Lower`, and `ci95Upper`.
- Added score-specific top-k linkage extraction in `frontend/lib/score-links.ts`.
- Added score interpretation UI components: `frontend/components/ScoreCard.tsx`, `frontend/components/ScoreDetailPanel.tsx`, and `frontend/components/PredictionOverview.tsx`.
- Added predictions route `frontend/app/(dashboard)/predictions/page.tsx` with analysis selector, category-grouped score cards, detailed score panel, BOLD time-series context, and correlation matrix integration.
- Added atlas label helper `frontend/lib/shen268-labels.ts` for region naming.
- Updated `frontend/lib/types.ts` with `PredictedScore` for typed score outputs.
- Updated `frontend/app/globals.css` with prediction card styles (`score-card`, `score-card-selected`, `category-header`) and standardized palette usage for a clinical blue theme.
- Updated `frontend/app/(dashboard)/layout.tsx` to include a `Predictions` navigation tab and a persistent bottom disclaimer (`Research tool - not for clinical diagnosis`).
- Added `View predictions` entry points in `frontend/app/(dashboard)/analysis/[executionId]/page.tsx` and `frontend/app/(dashboard)/statistics/page.tsx`.
- Updated Plotly color usage in `frontend/app/(dashboard)/predictions/page.tsx` and `frontend/app/(dashboard)/statistics/page.tsx` to match the standardized blue UI palette.
- Updated status-pill styling in `frontend/app/(dashboard)/dashboard/page.tsx` and `frontend/app/(dashboard)/history/page.tsx` to CSS-variable-based classes.
- Expanded `frontend/app/page.tsx` with a landing-page methodology section plus footer resources/citation and a research-use-only disclaimer.
- Added analysis loading route `frontend/app/(dashboard)/analysis/[executionId]/loading/page.tsx` to support progress UX while backend processing completes.
- Extensibility note: add new scores in `SCORE_REGISTRY` and new groups in `SCORE_CATEGORIES`; prediction overview rendering is data-driven.
- Added `notebooks/convert_txt_to_graph.py` wrapper for single-file graph conversion with preprocessing checks (orientation fix + zero-only row/column handling) while reusing `step1/step2` core computations.
- Added backend model-registry support in `backend/app/core/model_registry.py` with score-name normalization and deterministic `<score>.pt` resolution.
- Added backend env settings `MODEL_REGISTRY_DIR` and `MODEL_REGISTRY_SCORES` in `backend/app/core/config.py`.
- Updated backend startup in `backend/main.py` to auto-create the model registry folder and print found/missing model files per score.
- Added authenticated endpoint `GET /api/models` in `backend/app/api/analytics.py` to inspect model-path configuration and availability.
- Added `backend/models/README.md` documenting drop-in model naming and directory conventions for multi-score `.pt` files.
- Updated backend dependency checks and requirements to include graph/pytorch stack (`dill`, `torch`, `torch-geometric`).
- Updated `docs/README.md` backend env and model drop-in guidance for multi-score model deployment.
- Refactored backend analysis execution to a single-pass pipeline in `backend/app/services/model_service.py`, reusing one in-memory correlation computation for visualization and prediction.
- Added backend graph conversion + model inference path (`txt -> step1/step2 graph windows -> .pt model predictions`) and persisted outputs as `predicted_scores` and `prediction_errors`.
- Wired upload/retry execution to use `process_txt_data` directly in `backend/app/api/analytics.py`, with `execute_notebook_with_file` retained as a compatibility alias to the same single-pass path.
- Kept `notebooks/step1_compute_ldw.py` and `notebooks/step2_prepare_data.py` as source-of-truth preprocessing; extra input cleaning (orientation and zero-only row/column checks) is handled in wrapper/loader code.
- Updated frontend prediction view to consume backend `predicted_scores` first (with simulation fallback) in `frontend/components/PredictionOverview.tsx`.
- Added `ListSort (Age Adjusted)` score registry entry and aligned emotion score id to `emotion_recognition` in `frontend/lib/score-registry.ts`.

## 2026-02-13

### Backend: Fixed brain node coordinates (Shen268 atlas)
- Replaced fake golden-spiral coordinates (`_generate_demo_roi_coordinates`) with real Shen268 MNI centroid coordinates in `backend/app/services/model_service.py`.
- Added `backend/app/data/shen268_mni_coords.py` containing 268 (x, y, z) MNI centroids parsed from `shen268_centroids_mni.csv`.
- Source: Shen et al. (2013) "Groupwise whole-brain parcellation from resting-state fMRI data for network node identification", NeuroImage 82, 403-415. Centroid CSV downloaded from the BioImage Suite Web atlas repository (https://bioimagesuiteweb.github.io/webapp/parc268.html).
- Updated `coordinates_source` field from `"demo_generated"` to `"shen268_mni_atlas"` in connectome and marker payloads.
- Both the 3D interactive connectome (`nilearn.view_connectome`) and the static orthogonal marker PNG (`nilearn.plot_markers`) now render anatomically correct node positions.

### Frontend: Predictions page layout redesign
- Redesigned predictions page from vertical stack (sidebar + detail panel) to a 2x2 grid layout in `frontend/app/(dashboard)/predictions/page.tsx`.
  - Top-left: Correlation matrix heatmap (Plotly).
  - Top-right: Score selector tabs (Cognition/Emotion) + 3D interactive brain connectome.
  - Bottom-left: BOLD time series chart.
  - Bottom-right: Three static brain views (Sagittal, Coronal, Axial) side-by-side.
- Created `frontend/components/BrainVisualizationPanel.tsx` — score selector buttons grouped by category, selected score summary, 3D connectome iframe, and collapsible connection details (top-k links, threshold controls).
- Created `frontend/components/StaticBrainViews.tsx` — horizontal 3-panel display of ortho marker PNG with corrected view labels (Sagittal, Coronal, Axial matching nilearn `display_mode="ortho"` output order).
- Stripped `frontend/components/CorrelationMatrix.tsx` to heatmap-only (removed embedded connectome iframe, markers image, top-k controls, and top links list).
- Lifted score prediction computation (model predictions + simulation fallback) from `PredictionOverview` into `PredictionsContent` for shared state across grid quadrants.
- Deleted `frontend/components/PredictionOverview.tsx`, `frontend/components/ScoreDetailPanel.tsx`, and `frontend/components/ScoreCard.tsx` (functionality redistributed to new components).
