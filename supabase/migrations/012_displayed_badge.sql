-- Add displayed badge to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS displayed_badge integer;
