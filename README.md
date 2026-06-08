---
title: MindPulse Backend
emoji: 🧠
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# MindPulse

MindPulse is a full-stack neuroimaging web app for uploading ROI time-series files, running correlation and graph-model analysis, and viewing behavioral-score predictions with brain-region explanations.

- **Frontend:** Next.js App Router, deployed on Vercel at `https://gnn-web.vercel.app`
- **Backend:** FastAPI, deployed on Hugging Face Spaces at `https://yrlllllllllll-mindpulse.hf.space`
- **Database/Auth/Storage:** Supabase Auth, PostgreSQL, and Storage
- **Models:** PyTorch graph models loaded from `backend/models/`
- **Deployment sync:** GitHub Actions pushes `main` to Hugging Face Spaces automatically

## Repository Layout

```txt
.
|-- backend/                 FastAPI app, model services, Supabase services
|-- frontend/                Next.js app
|-- notebooks/               Graph preprocessing imported by backend
|-- training/                Model training code (kept on GitHub, not deployed to HF)
|-- database/                SQL schema dump for Supabase
|-- .github/workflows/       GitHub Actions automation
|-- Dockerfile               Hugging Face Spaces backend image
`-- .dockerignore            Backend image exclusions
```

## Deployment Architecture

The frontend and backend are deployed separately:

| Layer | Host | URL |
| --- | --- | --- |
| Frontend | Vercel | `https://gnn-web.vercel.app` |
| Backend API | Hugging Face Spaces | `https://yrlllllllllll-mindpulse.hf.space` |

### GitHub → Hugging Face auto-sync

The workflow at `.github/workflows/sync-to-hf.yml` pushes `main` to the Hugging Face Space on every commit. To enable it on a fresh fork:

1. Create a **Write** token at https://huggingface.co/settings/tokens
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New secret**
3. Name: `HF_TOKEN`, value: paste the token
4. Push any commit to `main` — the Action runs automatically

The workflow strips non-runtime folders (currently `training/`) before pushing, so they stay on GitHub but are never deployed to the Hugging Face Space.

## Local Setup

### 1. Clone and Pull LFS Assets

```bash
git lfs install
git lfs pull
```

Large model and data assets are tracked with Git LFS. The current `.gitattributes` tracks `.pt`, `.pth`, `.png`, and large backend brain-importance JSON files.

### 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

Backend docs are available at `http://localhost:8000/docs`.

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend is available at `http://localhost:3000`.

## Environment Variables

Template files are provided — copy each and fill in your own values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

The real `.env` files are gitignored and must never be committed.

### backend/.env

```env
SUPABASE_URL=https://<project_ref>.supabase.co
SUPABASE_KEY=<supabase_publishable_or_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
JWT_SECRET=<your_backend_jwt_secret>
DEBUG=True
MODEL_REGISTRY_DIR=./models
MODEL_REGISTRY_SCORES=listsort_ageadj,psqi,emotsupp_unadj,picseq,pmat
GENERATE_PLOTLY_JSON=false
GENERATE_NEURO_VISUALS=true
TORCH_NUM_THREADS=4
TORCH_NUM_INTEROP_THREADS=1
```

### frontend/.env.local

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project_ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<supabase_publishable_or_anon_key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Supabase Setup

Create a Supabase project, enable email/password auth, then run [`database/schema.sql`](database/schema.sql) in the Supabase SQL Editor for a fresh database.

Create a public Supabase Storage bucket named:

```txt
roi-analysis
```

The backend writes correlation graphs and matrices to this bucket through `backend/app/services/supabase_service.py`.

## Upload and Analysis Flow

1. A user signs up or signs in through Supabase Auth.
2. The user uploads a `.txt`, `.csv`, or `.tsv` ROI time-series file.
3. The FastAPI backend stores upload metadata in `file_uploads`.
4. The backend creates a linked `model_executions` row with status `queued`.
5. Background analysis computes correlation outputs, graph windows, model predictions, and explanations.
6. Full execution results are stored in `model_executions.results`.
7. Dashboard-friendly prediction rows are stored in `prediction_summaries`.
8. Optional correlation graph/matrix artifacts are written to the `roi-analysis` storage bucket.

## Model Registry

Model files live in `backend/models/` locally and `/app/models` on Hugging Face Spaces.

Expected model files:

```txt
listsort_ageadj.pt
psqi.pt
emotsupp_unadj.pt
picseq.pt
pmat.pt
```

The configured scores are controlled by:

```env
MODEL_REGISTRY_SCORES=listsort_ageadj,psqi,emotsupp_unadj,picseq,pmat
```

Use the authenticated endpoint below to inspect model availability:

```txt
GET /api/models
```

## Training

The `training/` folder holds the model-training code used to produce the `.pt`
weights in `backend/models/`. It is **not** part of the deployed runtime — the
backend loads the pre-trained weights directly. This folder is kept on GitHub for
reproducibility but is excluded from the Hugging Face Space (see the auto-sync note
above) and from the backend Docker image.

## Tooling and Framework Notes

- TypeScript: `^6.0.3`
- Next.js: `^16.2.6`
- ESLint is configured in `frontend/package.json`; verify the version before adjusting the `next lint` workflow.
- `frontend/proxy.ts` implements the Next.js 16 proxy convention.
- In Next.js 16, `cookies()` from `next/headers` is async; `await` it for server-side cookie reads. The current proxy uses `request.cookies`.
- `frontend/next.config.js` lists Plotly packages under `serverExternalPackages` to avoid SSR `__dirname is not defined` errors.
- Backend Supabase access uses `supabase-py` v2.x table and storage APIs.
- CORS is configured in `backend/main.py` through `allowed_origins` from `backend/app/core/config.py`.

## Metric Naming

The deployed model-score IDs are:

| Score ID | Display Meaning | Expected Range |
| --- | --- | --- |
| `listsort_ageadj` | NIH Toolbox List Sorting working memory, age-adjusted | 50-150 |
| `pmat` | Penn Matrix Analysis Test / fluid intelligence | 0-24 |
| `picseq` | NIH Picture Sequence Memory | 50-150 |
| `emotsupp_unadj` | NIH Emotional Support (T-score) | 0-100 |
| `psqi` | Pittsburgh Sleep Quality Index | 0-21 |

Brain-region labels and dashboard insights are aligned to these score constructs.

## Git LFS

Run this after cloning:

```bash
git lfs install
git lfs pull
```

Large files include model weights, generated brain visualizations, and backend brain-importance JSON files. Keep large binary assets out of normal Git history.

## Hugging Face Spaces Docker Image

The root `Dockerfile` builds only the backend runtime:

- Installs Python dependencies from `backend/requirements.txt`
- Copies `backend/` into `/app`
- Copies notebooks needed by backend analysis
- Exposes port `8000`
- Starts `uvicorn main:app --host 0.0.0.0 --port 8000`

`.dockerignore` excludes `frontend/`, `training/`, `database/`, local virtualenvs, caches, and other files not needed by the backend image.

## Troubleshooting

### Upload returns 500

- Confirm `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set on the backend.
- Confirm the Supabase schema above has been applied.
- Confirm the `roi-analysis` storage bucket exists if storage artifacts are enabled.

### User can sign up but no profile row appears

This is expected if the frontend direct Supabase signup path is used without the optional trigger. Add the `handle_user_email_confirmed` trigger if profile rows should be created automatically.

### Models are missing

- Run `git lfs pull`.
- Confirm `.pt` files exist in `backend/models/` locally or `/app/models` on Hugging Face Spaces.
- Check `GET /api/models` while authenticated.
