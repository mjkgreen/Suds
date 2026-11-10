import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DRINK_BRANDS, DRINK_NAMES } from '@/lib/drinkData';
import { CatalogEntry, DrinkCatalog, mergeCatalog } from '@/lib/drinkSearch';
import { useAuthStore } from '@/stores/authStore';
import { DrinkType } from '@/types/models';

/** The table changes at most once a night, so refetching twice a day is plenty. */
const CATALOG_STALE_TIME = 1000 * 60 * 60 * 12;
const MAX_ENTRIES = 5000;

interface CatalogRow {
  kind: 'name' | 'brand';
  label: string;
  drink_type: DrinkType;
}

/**
 * Drink names and brands for autocomplete: the list built into the app plus
 * the drink_catalog table (popular entries promoted nightly, and any you add
 * by hand). Falls back to the built-in list until the table loads, offline,
 * or if the request fails.
 */
export function useDrinkCatalog(): { names: DrinkCatalog; brands: DrinkCatalog } {
  const userId = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ['drinkCatalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_catalog')
        .select('kind, label, drink_type')
        .order('user_count', { ascending: false })
        .limit(MAX_ENTRIES);
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
    enabled: !!userId,
    staleTime: CATALOG_STALE_TIME,
    retry: 1,
  });

  return useMemo(() => {
    const rows = data ?? [];
    const pick = (kind: 'name' | 'brand'): CatalogEntry[] =>
      rows.filter((r) => r.kind === kind).map((r) => ({ label: r.label, drink_type: r.drink_type }));
    return {
      names: mergeCatalog(DRINK_NAMES, pick('name')),
      brands: mergeCatalog(DRINK_BRANDS, pick('brand')),
    };
  }, [data]);
}
