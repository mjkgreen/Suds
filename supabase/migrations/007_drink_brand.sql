-- Add brand and rating columns to drink_logs
ALTER TABLE public.drink_logs
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS rating integer CHECK (rating >= 1 AND rating <= 10);
