# Model Registry Directory

Drop trained prediction model files (`.pt`) in this folder.

## Naming Convention

Model filenames are resolved by score name:

- `listsort_ageadj` -> `listsort_ageadj.pt`
- `sleep_quality` -> `sleep_quality.pt`
- `emotion_recognition` -> `emotion_recognition.pt`
- `picseq` -> `picseq.pt`
- `pmat` -> `pmat.pt`

Optional target scalers are resolved from `scalers/<score>_target_scaler.json`.
The JSON format is preferred at runtime because it avoids pickle/joblib and
scikit-learn version coupling. A matching `.joblib` file may be kept beside it
for provenance or offline compatibility.

Current scaler artifacts:

- `scalers/listsort_ageadj_target_scaler.json`
- `scalers/listsort_ageadj_target_scaler.joblib`

## Environment Variables

Configure in `backend/.env`:

- `MODEL_REGISTRY_DIR=./models`
- `MODEL_REGISTRY_SCORES=listsort_ageadj,sleep_quality,emotion_recognition,picseq,pmat`
- `GENERATE_PLOTLY_JSON=false`
- `GENERATE_NEURO_VISUALS=true`
- `TORCH_NUM_THREADS=4`
- `TORCH_NUM_INTEROP_THREADS=1`

Add more comma-separated score IDs only after the matching `.pt` files are placed in this folder.

The backend startup log and `GET /api/models` endpoint report which configured model files are present or missing.
