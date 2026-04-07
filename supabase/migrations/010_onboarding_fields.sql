-- Add onboarding fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS height numeric(5,2),
ADD COLUMN IF NOT EXISTS height_unit text DEFAULT 'in' CHECK (height_unit IN ('cm', 'in')),
ADD COLUMN IF NOT EXISTS weight numeric(5,1),
ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'lb' CHECK (weight_unit IN ('kg', 'lb')),
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
