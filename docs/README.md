# Project README

## What This Project Does

This project is a web app that lets users upload ROI time-series data (.txt) and view a correlation matrix with stats and history.

- Frontend: Next.js app (UI + auth)
- Backend: FastAPI API (file upload + analysis)
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- Analysis: Correlation matrix computed from ROI time-series data

---

## Quick Start (Local, No Docker)

### 1) Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase project (URL, anon key, service role key)

### 2) Supabase Schema
Run the SQL below in the Supabase SQL Editor.

### 3) Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

Backend docs: http://localhost:8000/docs

if in cmd, venv\Scripts\activate
### 4) Frontend
```powershell
cd frontend
npm install
npm run dev
```

Frontend app: http://localhost:3000

---

## Environment Variables

### backend/.env
```
SUPABASE_URL=https://<project_ref>.supabase.co
SUPABASE_KEY=<anon_or_publishable_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<your_secret>
DEBUG=True
MODEL_REGISTRY_DIR=./models
MODEL_REGISTRY_SCORES=listsort_ageadj,sleep_quality,emotsupp_unadj,picseq,pmat
GENERATE_PLOTLY_JSON=false
GENERATE_NEURO_VISUALS=true
TORCH_NUM_THREADS=4
TORCH_NUM_INTEROP_THREADS=1
```

### frontend/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://<project_ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<publishable_key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## How Upload Works

1) User uploads a .txt file on the Upload page
2) Backend saves it and creates DB records
3) Backend runs a single-pass analysis pipeline (correlation + graph windows + model inference)
4) Results are stored in DB and shown in the UI

### Model Drop-In Path

- Put `.pt` files in `backend/models/` (or your `MODEL_REGISTRY_DIR` path).
- File naming convention is score-based:
  - `listsort_ageadj.pt`
  - `sleep_quality.pt`
  - `emotsupp_unadj.pt`
  - `picseq.pt`
  - `pmat.pt`
- Startup logs show found/missing model files, and you can query the registry via `GET /api/models`.
- By default, the backend registry is configured for
  `listsort_ageadj,sleep_quality,emotsupp_unadj,picseq,pmat`.

---

## Common Issues

- "Error loading ASGI app. Could not import module 'app.main'"
  - Run: python -m uvicorn main:app --port 8000 --reload

- 500 error on upload
  - Check `SUPABASE_SERVICE_ROLE_KEY` is set in `backend/.env`
  - Ensure the schema below is applied

---

## Supabase SQL (Schema + RLS)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- File uploads
CREATE TABLE IF NOT EXISTS file_uploads (
  upload_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  storage_path TEXT,
  status TEXT DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'))
);

-- Model executions
CREATE TABLE IF NOT EXISTS model_executions (
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

-- Analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES model_executions ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  metrics JSONB NOT NULL,
  charts_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_executions_user_id ON model_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_model_executions_upload_id ON model_executions(upload_id);
CREATE INDEX IF NOT EXISTS idx_model_executions_status ON model_executions(status);
CREATE INDEX IF NOT EXISTS idx_model_executions_created_at ON model_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_execution_id ON analysis_results(execution_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies - User Profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can create profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies - File Uploads
CREATE POLICY "Users can view own uploads" ON file_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create uploads" ON file_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON file_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON file_uploads FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies - Model Executions
CREATE POLICY "Users can view own executions" ON model_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create executions" ON model_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executions" ON model_executions FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies - Analysis Results
CREATE POLICY "Users can view own results" ON analysis_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create results" ON analysis_results FOR INSERT WITH CHECK (auth.uid() = user_id);
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

---

## Backend Requirements (requirements.txt)

```txt
fastapi>=0.100,<0.105
uvicorn>=0.23,<0.25
python-multipart>=0.0.6
python-jose[cryptography]>=3.3
pydantic>=2.4,<3.0
pydantic-settings>=2.0,<3.0
pandas>=2.1,<3.0
scikit-learn>=1.3,<2.0
numpy>=1.26,<2.0
supabase>=2.20,<3.0
python-dotenv>=1.0
httpx>=0.26,<0.28
psycopg2-binary>=2.9,<3.0
sqlalchemy>=2.0,<3.0
matplotlib>=3.8,<4.0
plotly>=5.18,<6.0
papermill>=2.5,<3.0
jupyter>=1.0,<2.0
nbformat>=5.9,<6.0
nilearn>=0.10,<0.12
dill>=0.3.8,<0.4.0
torch>=2.2,<3.0
torch-geometric>=2.5,<3.0
```

---

## Where to Look

- Backend: backend/app/
- Frontend: frontend/app/
- Notebook: notebooks/plot_corr_matrix.ipynb
