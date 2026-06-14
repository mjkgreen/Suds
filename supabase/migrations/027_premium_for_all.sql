-- ============================================================
-- GRANT PREMIUM TO ALL USERS (launch period)
-- ============================================================

-- Change default so every new signup starts as premium
ALTER TABLE public.profiles
  ALTER COLUMN subscription_tier SET DEFAULT 'premium';

-- Backfill all existing users
UPDATE public.profiles
  SET subscription_tier = 'premium'
  WHERE subscription_tier = 'free';

-- Update the new-user trigger to explicitly grant premium
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, subscription_tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'premium'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
