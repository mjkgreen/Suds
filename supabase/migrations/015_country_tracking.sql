-- Add country code to drink logs
ALTER TABLE public.drink_logs
ADD COLUMN IF NOT EXISTS location_country_code text;
