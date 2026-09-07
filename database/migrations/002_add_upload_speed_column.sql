-- ------------------------------------------------------------------------------
-- Migration: Add upload_speed_mbps column to measurement_results table
-- ------------------------------------------------------------------------------
ALTER TABLE public.measurement_results 
ADD COLUMN IF NOT EXISTS upload_speed_mbps DOUBLE PRECISION DEFAULT 0.0;

COMMENT ON COLUMN public.measurement_results.upload_speed_mbps IS 'Measured HTTP POST upload throughput speed in Mbps';
