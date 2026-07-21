import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { mapCompany } from "@/lib/supabase/mappers";
import type { Company } from "@/types/game";

interface CompaniesState {
  companies: Company[];
  loading: boolean;
  error: string | null;
}

let cache: Company[] | null = null;

/**
 * The 30 deed cards never change during a game (or between games), so we
 * fetch them once per browser session and reuse the result everywhere.
 */
export function useCompanies(): CompaniesState {
  const [state, setState] = useState<CompaniesState>({
    companies: cache ?? [],
    loading: cache === null,
    error: null,
  });

  useEffect(() => {
    if (cache) return;

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.from("companies").select("*").order("id");
      if (cancelled) return;

      if (error || !data) {
        setState({ companies: [], loading: false, error: error?.message ?? "could not load companies" });
        return;
      }

      cache = data.map(mapCompany);
      setState({ companies: cache, loading: false, error: null });
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
