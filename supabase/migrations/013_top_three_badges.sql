-- Update profile to support top 3 badges
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS displayed_badge,
ADD COLUMN IF NOT EXISTS displayed_badges text[] DEFAULT '{}';
