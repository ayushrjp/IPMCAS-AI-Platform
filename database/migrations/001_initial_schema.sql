-- ==============================================================================
-- IPMCAS Platform - Migration 001: Initial Core Schema & RLS Policies
-- PostgreSQL Schema for Supabase Integration
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create a public.profiles entry when a user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. Networks Table (User Network Environments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    network_type VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    network_name TEXT,
    isp TEXT,
    asn INTEGER,
    country VARCHAR(2),
    region TEXT,
    hashed_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_network_type CHECK (network_type IN ('WIFI', 'ETHERNET', 'CELLULAR_4G', 'CELLULAR_5G', 'UNKNOWN'))
);

-- ------------------------------------------------------------------------------
-- 3. Test Servers Table (Edge Node Directory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    region TEXT NOT NULL,
    country VARCHAR(2) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '{"download": true, "upload": true, "latency": true}'::jsonb,
    priority INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Measurement Sessions Table (Parent Speed Test Session)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.measurement_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    network_id UUID REFERENCES public.networks(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'INITIALIZING',
    client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Measurement Results Table (Detailed Numerical Test Results)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.measurement_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.measurement_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES public.test_servers(id),
    test_type VARCHAR(32) NOT NULL DEFAULT 'FULL',
    concurrency INTEGER NOT NULL DEFAULT 4,
    configured_duration_s DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    actual_duration_s DOUBLE PRECISION NOT NULL,
    bytes_transferred BIGINT NOT NULL DEFAULT 0,
    throughput_mbps DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    latency_min_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    latency_avg_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    latency_median_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    latency_max_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    jitter_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    packet_loss_percent DOUBLE PRECISION, -- NULLABLE when unmeasurable by browser
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    rate_limited_requests INTEGER NOT NULL DEFAULT 0, -- HTTP 429 count
    other_http_errors INTEGER NOT NULL DEFAULT 0,
    request_exceptions INTEGER NOT NULL DEFAULT 0,
    http_status INTEGER NOT NULL DEFAULT 200,
    status VARCHAR(32) NOT NULL,
    error TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_concurrency CHECK (concurrency >= 1),
    CONSTRAINT chk_duration CHECK (actual_duration_s > 0),
    CONSTRAINT chk_throughput CHECK (throughput_mbps >= 0),
    CONSTRAINT chk_bytes CHECK (bytes_transferred >= 0),
    CONSTRAINT chk_requests CHECK (successful_requests <= total_requests AND rate_limited_requests <= total_requests)
);

-- ------------------------------------------------------------------------------
-- 6. AI Conversations Table (Future AI Intelligence Chat Context Logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.measurement_sessions(id) ON DELETE SET NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. Database Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_measurement_sessions_user_started 
    ON public.measurement_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_measurement_results_user_created 
    ON public.measurement_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_measurement_results_session 
    ON public.measurement_results(session_id);

CREATE INDEX IF NOT EXISTS idx_networks_user 
    ON public.networks(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created 
    ON public.ai_conversations(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Enable RLS on user-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_servers ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles - Users read own profile" 
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles - Users update own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Networks Policies
CREATE POLICY "Networks - Users manage own networks" 
    ON public.networks FOR ALL USING (auth.uid() = user_id);

-- Measurement Sessions Policies
CREATE POLICY "Sessions - Users manage own sessions" 
    ON public.measurement_sessions FOR ALL USING (auth.uid() = user_id);

-- Measurement Results Policies
CREATE POLICY "Results - Users manage own results" 
    ON public.measurement_results FOR ALL USING (auth.uid() = user_id);

-- AI Conversations Policies
CREATE POLICY "AI Conversations - Users manage own chat context" 
    ON public.ai_conversations FOR ALL USING (auth.uid() = user_id);

-- Test Servers Policies (Publicly readable, write restricted to service role)
CREATE POLICY "Test Servers - Public Read" 
    ON public.test_servers FOR SELECT USING (true);

CREATE POLICY "Test Servers - Service Role Write" 
    ON public.test_servers FOR ALL USING (auth.role() = 'service_role');
