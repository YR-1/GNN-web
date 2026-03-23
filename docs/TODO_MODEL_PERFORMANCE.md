# TODO: Replace Model Performance Placeholder Data

## Goal
When real model results are available, replace placeholder values used in the Model Performance page.

## Update These Metrics
- Correlation (`correlation`)
- p-value (`pValue`)
- Mean squared error (`mse`)

## Update Predicted vs Actual Scatter Data
- Replace generated/simulated scatter data with real pairs:
	- `actual`: ground-truth score
	- `predicted`: model-predicted score

## Where To Modify

### 1) Backend seed metrics (table values)
- File: `backend/app/api/analytics.py`
- Section: `MODEL_PERFORMANCE_SEEDS`
- What to edit:
	- score id
	- display score name
	- `correlation`
	- `p_value`
	- `mse`
	- `seed` (only used for synthetic scatter generation)

### 2) Backend scatter payload generation
- File: `backend/app/api/analytics.py`
- Functions:
	- `_generate_scatter_data(seed, correlation)`
	- `_build_model_performance_payload()`
- If using real scatter points:
	- stop relying on `_generate_scatter_data` for production values
	- provide real `scatterData` arrays directly in `_build_model_performance_payload`

### 3) Backend API endpoint consumed by frontend
- File: `backend/app/api/analytics.py`
- Endpoint: `GET /api/model-performance`
- Keep response shape compatible with frontend:
	- `id`
	- `behavioralScore`
	- `correlation`
	- `pValue`
	- `mse`
	- `scatterData: [{ actual, predicted }, ...]`

### 4) Frontend page rendering
- File: `frontend/app/(dashboard)/model-performance/page.tsx`
- Uses backend endpoint via `api.getModelPerformance()`.
- Usually no UI logic changes are needed if response shape stays the same.

### 5) Frontend API client method
- File: `frontend/lib/api.ts`
- Method: `getModelPerformance()`
- Keep endpoint path as `/api/model-performance` unless backend route changes.

## Quick Validation After Updating Data
1. Start backend and confirm `GET /api/model-performance` returns expected values.
2. Open `/model-performance` and verify table metrics and scatter plots match your data.
3. Run frontend type check:
	 - from `frontend`: `npm run type-check`

## Notes
- Current scatter plots are deterministic synthetic data unless replaced with real points.
- If you only update `MODEL_PERFORMANCE_SEEDS`, table metrics update immediately, and scatter plots still remain synthetic.
