-- Replace age (integer) with birthdate (date) for more accurate BAC calculations
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthdate date;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS age;
