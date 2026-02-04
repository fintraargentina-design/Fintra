import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

// ===== FETCHERS OPTIMIZADOS CON RPC =====

/**
 * Fetch countries usando RPC (mucho más rápido que conteo manual)
 * Requiere función SQL: get_country_counts()
 */
const fetchCountries = async (): Promise<FilterOption[]> => {
  // Intentar usar RPC primero (10x más rápido)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_country_counts');

  if (!rpcError && rpcData) {
    const options = rpcData.map((row: any) => ({
      value: row.country,
      label: `${row.country} (${row.count})`,
      count: Number(row.count)
    }));

    // Add "All Countries"
    const total = options.reduce((sum: number, opt: any) => sum + opt.count, 0);
    return [
      { value: 'All Countries', label: `All Countries (${total})`, count: total },
      ...options
    ];
  }

  // Fallback al método anterior si RPC no existe aún
  console.warn('⚠️ RPC get_country_counts not found, using fallback method');
  
  const { data, error } = await supabase
    .from('company_profile')
    .select('country')
    .not('country', 'is', null);

  if (error) throw error;

  // Conteo manual (menos eficiente)
  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.country] = (counts[row.country] || 0) + 1;
  });

  const options = Object.entries(counts)
    .map(([country, count]) => ({
      value: country,
      label: `${country} (${count})`,
      count
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  const total = options.reduce((sum, opt) => sum + opt.count, 0);
  return [
    { value: 'All Countries', label: `All Countries (${total})`, count: total },
    ...options
  ];
};

/**
 * Fetch sectors usando RPC
 * Requiere función SQL: get_sector_counts(country TEXT)
 */
const fetchSectors = async (country: string): Promise<FilterOption[]> => {
  if (!country) return [];
  
  const isAllCountries = country === 'All Countries';

  // Intentar RPC primero
  // Si es All Countries, el RPC podría no estar preparado para recibir NULL o ignorar el filtro.
  // Probaremos pasar NULL si es All Countries.
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_sector_counts', { p_country: isAllCountries ? null : country });

  if (!rpcError && rpcData) {
    const options = rpcData.map((row: any) => ({
      value: row.sector,
      label: `${row.sector} (${row.count})`,
      count: Number(row.count)
    }));

    return options;
  }

  // Fallback
  console.warn('⚠️ RPC get_sector_counts not found or failed, using fallback method');
  
  let query = supabase
    .from('company_profile')
    .select('sector')
    .not('sector', 'is', null);
    
  if (!isAllCountries) {
    query = query.eq('country', country);
  }

  const { data, error } = await query;

  if (error) throw error;

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.sector] = (counts[row.sector] || 0) + 1;
  });

  const options = Object.entries(counts)
    .map(([sector, count]) => ({
      value: sector,
      label: `${sector} (${count})`,
      count
    }))
    .sort((a, b) => b.count - a.count);
    
  return options;
};

/**
 * Fetch industries usando RPC
 * Requiere función SQL: get_industry_counts(country TEXT, sector TEXT)
 */
const fetchIndustries = async (
  country: string, 
  sector: string
): Promise<FilterOption[]> => {
  if (!country || !sector) return [];

  const isAllCountries = country === 'All Countries';
  const isAllSectors = sector === 'All Sectors';

  // Intentar RPC primero
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_industry_counts', { 
      p_country: isAllCountries ? null : country, 
      p_sector: isAllSectors ? null : sector 
    });

  if (!rpcError && rpcData) {
    const options = rpcData.map((row: any) => ({
      value: row.industry,
      label: `${row.industry} (${row.count})`,
      count: Number(row.count)
    }));

    return options;
  }

  // Fallback
  console.warn('⚠️ RPC get_industry_counts not found, using fallback method');
  
  let query = supabase
    .from('company_profile')
    .select('industry')
    .not('industry', 'is', null);

  if (!isAllCountries) {
    query = query.eq('country', country);
  }
  
  if (!isAllSectors) {
    query = query.eq('sector', sector);
  }

  const { data, error } = await query;

  if (error) throw error;

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.industry] = (counts[row.industry] || 0) + 1;
  });

  const options = Object.entries(counts)
    .map(([industry, count]) => ({
      value: industry,
      label: `${industry} (${count})`,
      count
    }))
    .sort((a, b) => b.count - a.count);

  return options;
};

// ===== CUSTOM HOOK =====

interface UseFilterOptionsReturn {
  countries: FilterOption[];
  sectors: FilterOption[];
  industries: FilterOption[];
  isLoading: boolean;
  error: Error | null;
}

export function useFilterOptions(
  selectedCountry: string, 
  selectedSector: string
): UseFilterOptionsReturn {
  
  // Fetch countries (se carga una vez y se cachea)
  const { 
    data: countries, 
    isLoading: loadingCountries,
    error: countriesError 
  } = useSWR(
    'filter-countries',
    fetchCountries,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000 // Cache por 1 minuto
    }
  );

  // Fetch sectors (depende de country)
  const { 
    data: sectors, 
    isLoading: loadingSectors,
    error: sectorsError
  } = useSWR(
    selectedCountry ? ['filter-sectors', selectedCountry] : null,
    ([_, country]) => fetchSectors(country),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  // Fetch industries (depende de country + sector)
  const { 
    data: industries, 
    isLoading: loadingIndustries,
    error: industriesError
  } = useSWR(
    selectedCountry && selectedSector ? ['filter-industries', selectedCountry, selectedSector] : null,
    ([_, country, sector]) => fetchIndustries(country, sector),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  );

  return {
    countries: countries || [],
    sectors: sectors || [],
    industries: industries || [],
    isLoading: loadingCountries || loadingSectors || loadingIndustries,
    error: (countriesError || sectorsError || industriesError) as Error | null
  };
}
