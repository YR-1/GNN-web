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
|-- notebooks/               Data conversion and analysis notebooks/scripts
|-- docs/                    Project notes and changelog
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

Create a Supabase project, enable email/password auth, then run the SQL below in the Supabase SQL Editor for a fresh database.

Create a public Supabase Storage bucket named:

```txt
roi-analysis
```

The backend writes correlation graphs and matrices to this bucket through `backend/app/services/supabase_service.py`.

### Schema, RLS, and Grants

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- File uploads
CREATE TABLE file_uploads (
  upload_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'))
);

-- Model executions
CREATE TABLE model_executions (
  execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES file_uploads ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT DEFAULT 'queued',
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER,
  CONSTRAINT valid_execution_status CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

-- ROI analyses metadata (for supabase_service.py)
CREATE TABLE roi_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES model_executions ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Prediction summaries
CREATE TABLE prediction_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES model_executions ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES file_uploads ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  score_id TEXT NOT NULL,
  predicted_value DOUBLE PRECISION NOT NULL,
  top_regions JSONB DEFAULT '[]'::jsonb,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_status ON file_uploads(status);
CREATE INDEX idx_file_uploads_created_at ON file_uploads(created_at DESC);

CREATE INDEX idx_model_executions_user_id ON model_executions(user_id);
CREATE INDEX idx_model_executions_upload_id ON model_executions(upload_id);
CREATE INDEX idx_model_executions_status ON model_executions(status);
CREATE INDEX idx_model_executions_created_at ON model_executions(created_at DESC);

CREATE INDEX idx_roi_analyses_user_id ON roi_analyses(user_id);
CREATE INDEX idx_roi_analyses_execution_id ON roi_analyses(execution_id);

CREATE INDEX idx_prediction_summaries_user_id ON prediction_summaries(user_id);
CREATE INDEX idx_prediction_summaries_score_id ON prediction_summaries(score_id);
CREATE INDEX idx_prediction_summaries_completed_at ON prediction_summaries(completed_at DESC);
CREATE INDEX idx_prediction_summaries_execution_id ON prediction_summaries(execution_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_summaries ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can create profile" ON user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- File uploads policies
CREATE POLICY "Users can view own uploads" ON file_uploads
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create uploads" ON file_uploads
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploads" ON file_uploads
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads" ON file_uploads
FOR DELETE USING (auth.uid() = user_id);

-- Model executions policies
CREATE POLICY "Users can view own executions" ON model_executions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create executions" ON model_executions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own executions" ON model_executions
FOR UPDATE USING (auth.uid() = user_id);

-- ROI analyses policies
CREATE POLICY "Users can view own roi analyses" ON roi_analyses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create roi analyses" ON roi_analyses
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Prediction summaries policies
CREATE POLICY "Users can view own prediction summaries" ON prediction_summaries
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create prediction summaries" ON prediction_summaries
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prediction summaries" ON prediction_summaries
FOR DELETE USING (auth.uid() = user_id);

grant usage on schema public to service_role;

grant select, insert, update, delete
on table public.user_profiles
to service_role;

grant select, insert, update, delete
on table public.file_uploads
to service_role;

grant select, insert, update, delete
on table public.model_executions
to service_role;

grant select, insert, update, delete
on table public.roi_analyses
to service_role;

grant select, insert, update, delete
on table public.prediction_summaries
to service_role;

grant usage, select, update
on all sequences in schema public
to service_role;
```

### Optional: Create user_profiles after email confirmation

```sql
create or replace function public.handle_user_email_confirmed()
returns trigger as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at <> new.email_confirmed_at) then
    insert into public.user_profiles (id, email, created_at, updated_at)
    values (new.id, new.email, now(), now())
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_confirmed on auth.users;

create trigger on_auth_user_confirmed
after update on auth.users
for each row execute function public.handle_user_email_confirmed();
```

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

Large files include model weights, generated brain visualizations, atlas files, and backend data JSON files. Keep large binary assets out of normal Git history.

## Hugging Face Spaces Docker Image

The root `Dockerfile` builds only the backend runtime:

- Installs Python dependencies from `backend/requirements.txt`
- Copies `backend/` into `/app`
- Copies notebooks needed by backend analysis
- Copies Shen atlas files into `/app`
- Exposes port `8000`
- Starts `uvicorn main:app --host 0.0.0.0 --port 8000`

`.dockerignore` excludes `frontend/`, `docs/`, local virtualenvs, caches, notebooks outputs, and other files not needed by the backend image.

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
