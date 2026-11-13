-- ============================================================
-- DRINK CATALOG
--
-- Drink names and brands that autocomplete suggests on top of
-- the list built into the app (src/lib/drinkData.ts). Because it
-- lives here, adding or removing suggestions doesn't need an app
-- update: the app downloads this table and merges it in.
--
-- Rows come from two places:
--   • 'auto': a weekly job promotes any name or brand that at
--     least 3 different people have logged under the same drink
--     type. Counting people rather than logs means one person
--     logging their homebrew 40 times doesn't add it for everyone.
--     Spellings are merged ("Joe's IPA" = "joes ipa"), and the
--     most common spelling is the one shown.
--   • 'manual': rows you insert yourself.
--
-- Managing it from the SQL editor:
--   Add one:      INSERT INTO drink_catalog (kind, label, drink_type)
--                 VALUES ('brand', 'Collective Arts', 'beer');
--   Hide one:     UPDATE drink_catalog SET hidden = true
--                 WHERE label = 'Something';
--                 (Hidden rows stay hidden; the weekly job never
--                 brings them back.)
--   Block a word: INSERT INTO drink_catalog_blocked_terms VALUES ('word');
--                 then SELECT refresh_drink_catalog();
--   Refresh now:  SELECT refresh_drink_catalog();
--   Change the
--   threshold:    SELECT refresh_drink_catalog(5);  -- one-off
--                 (or edit the cron job's command below)
-- ============================================================

-- ── 1. Normalizing labels ────────────────────────────────────
-- Lowercase, "&" → "and", drop apostrophes and periods, collapse
-- whitespace. Mirrored by normalizeLabel() in src/lib/drinkSearch.ts.
CREATE OR REPLACE FUNCTION public.normalize_drink_label(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(
             replace(lower(coalesce(p, '')), '&', ' and '),
             '[''’‘`.]', '', 'g'),
           '\s+', ' ', 'g'));
$$;

-- ── 2. Catalog ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drink_catalog (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text        NOT NULL CHECK (kind IN ('name', 'brand')),
  label       text        NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 60),
  drink_type  text        NOT NULL CHECK (drink_type IN (
                'water', 'beer', 'wine', 'cocktail', 'spirit', 'cider', 'seltzer',
                'soft_drink', 'mocktail', 'non_alcoholic', 'other')),
  normalized  text        GENERATED ALWAYS AS (public.normalize_drink_label(label)) STORED,
  source      text        NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  user_count  integer     NOT NULL DEFAULT 0,
  hidden      boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, normalized, drink_type)
);

ALTER TABLE public.drink_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read visible suggestions. Nobody writes
-- through the API; rows come from the job or the SQL editor.
CREATE POLICY "drink_catalog_select" ON public.drink_catalog
  FOR SELECT TO authenticated
  USING (NOT hidden);

GRANT SELECT ON public.drink_catalog TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.drink_catalog FROM anon, authenticated;

-- ── 3. Blocked terms ─────────────────────────────────────────
-- Any label containing one of these as a whole word is never
-- promoted. Plain lowercase words only (they're matched with
-- word boundaries). Not readable through the API.
CREATE TABLE IF NOT EXISTS public.drink_catalog_blocked_terms (
  term text PRIMARY KEY CHECK (term = lower(term) AND term ~ '^[a-z0-9 ]+$')
);
ALTER TABLE public.drink_catalog_blocked_terms ENABLE ROW LEVEL SECURITY;

INSERT INTO public.drink_catalog_blocked_terms (term) VALUES
  ('fuck'), ('fucking'), ('fucked'), ('shit'), ('shitty'), ('bitch'), ('cunt'),
  ('cock'), ('dick'), ('pussy'), ('whore'), ('slut'), ('bastard'), ('asshole'),
  ('cum'), ('porn'), ('nazi'), ('hitler'), ('rape'), ('rapist'),
  ('nigger'), ('nigga'), ('faggot'), ('fag'), ('retard'), ('retarded'),
  ('tranny'), ('kike'), ('spic'), ('chink'), ('wetback'), ('coon'),
  ('cocaine'), ('mdma'), ('ketamine'), ('meth'), ('heroin'),
  ('weed'), ('shroom'), ('shrooms'), ('lsd')
ON CONFLICT DO NOTHING;

-- ── 4. Weekly promotion job ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_drink_catalog(p_min_users integer DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DROP TABLE IF EXISTS _drink_catalog_candidates;

  CREATE TEMP TABLE _drink_catalog_candidates ON COMMIT DROP AS
  WITH raw AS (
    SELECT 'name'::text AS kind, btrim(dl.drink_name) AS label, dl.drink_type, dl.user_id
      FROM public.drink_logs dl
     WHERE dl.drink_name IS NOT NULL
    UNION ALL
    SELECT 'brand'::text, btrim(dl.brand), dl.drink_type, dl.user_id
      FROM public.drink_logs dl
     WHERE dl.brand IS NOT NULL
  ),
  grouped AS (
    SELECT r.kind,
           public.normalize_drink_label(r.label)        AS normalized,
           r.drink_type,
           mode() WITHIN GROUP (ORDER BY r.label)       AS label,
           count(DISTINCT r.user_id)::int               AS user_count
      FROM raw r
     WHERE char_length(r.label) BETWEEN 2 AND 60
     GROUP BY 1, 2, 3
  )
  SELECT g.*
    FROM grouped g
   WHERE g.user_count >= p_min_users
     AND g.normalized ~ '[a-z]'                          -- not just numbers/symbols
     AND g.label !~* '(https?://|www\.|@|#)'             -- no links, mentions, hashtags
     AND NOT EXISTS (
       SELECT 1 FROM public.drink_catalog_blocked_terms b
        WHERE g.normalized ~ ('\m' || b.term || '\M')
     );

  -- Add new entries and update counts. Only rewrite rows that changed,
  -- so a quiet week writes nothing.
  INSERT INTO public.drink_catalog (kind, label, drink_type, source, user_count)
  SELECT c.kind, c.label, c.drink_type, 'auto', c.user_count
    FROM _drink_catalog_candidates c
  ON CONFLICT (kind, normalized, drink_type) DO UPDATE
     SET user_count = EXCLUDED.user_count,
         -- Keep your spelling on manual rows; follow the crowd on auto rows.
         label      = CASE WHEN public.drink_catalog.source = 'auto'
                           THEN EXCLUDED.label ELSE public.drink_catalog.label END,
         updated_at = now()
   WHERE public.drink_catalog.user_count IS DISTINCT FROM EXCLUDED.user_count
      OR (public.drink_catalog.source = 'auto'
          AND public.drink_catalog.label IS DISTINCT FROM EXCLUDED.label);

  -- Drop auto entries that no longer qualify (drinks deleted, a term
  -- blocked). Hidden rows are kept so they stay hidden; manual rows
  -- are never touched.
  DELETE FROM public.drink_catalog dc
   WHERE dc.source = 'auto'
     AND NOT dc.hidden
     AND NOT EXISTS (
       SELECT 1 FROM _drink_catalog_candidates c
        WHERE c.kind = dc.kind
          AND c.normalized = dc.normalized
          AND c.drink_type = dc.drink_type
     );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_drink_catalog(integer) FROM PUBLIC, anon, authenticated;

-- ── 5. Schedule it (weekly, Mondays 08:23 UTC ≈ 3–4am Eastern) ────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'refresh-drink-catalog',
  '23 8 * * 1',
  'SELECT public.refresh_drink_catalog()'
);

-- ── 6. Fill it now ───────────────────────────────────────────
SELECT public.refresh_drink_catalog();
