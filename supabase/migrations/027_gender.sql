-- Add biological sex field to profiles for BAC calculation (Widmark formula)
-- Values: 'male' | 'female' | 'other'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('male', 'female', 'other'));
