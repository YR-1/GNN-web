-- =====================================================================
-- MindPulse — Supabase / PostgreSQL database schema
-- =====================================================================
-- Run this in the Supabase SQL Editor (or psql) against a fresh database
-- to recreate all tables, indexes, Row Level Security, policies, and grants.
--
-- Notes:
--   * Auth users live in Supabase's built-in `auth.users` table; the tables
--     below reference it via foreign keys.
--   * Also create a PUBLIC Storage bucket named `roi-analysis` (used by
--     backend/app/services/supabase_service.py) — buckets are not created
--     by SQL.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Grants (service_role used by the backend)
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- auto-create user_profiles row after email confirmation
-- ---------------------------------------------------------------------

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
