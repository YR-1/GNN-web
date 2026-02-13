# Model Registry Directory

Drop trained prediction model files (`.pt`) in this folder.

## Naming Convention

Model filenames are resolved by score name:

- `listsort_ageadj` -> `listsort_ageadj.pt`
- `sleep_quality` -> `sleep_quality.pt`
- `emotion_recognition` -> `emotion_recognition.pt`
- `sustained_attention` -> `sustained_attention.pt`
- `pmat` -> `pmat.pt`

## Environment Variables

Configure in `backend/.env`:

- `MODEL_REGISTRY_DIR=./models`
- `MODEL_REGISTRY_SCORES=listsort_ageadj,sleep_quality,emotion_recognition,sustained_attention,pmat`

The backend startup log and `GET /api/models` endpoint report which configured model files are present or missing.
