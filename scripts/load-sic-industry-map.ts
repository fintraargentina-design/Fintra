
import 'dotenv/config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';

type RawIndustryNode = {
  sicCode?: string | number | null;
  sector?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
};

type IndustryClassificationRow = {
  industry_code: string;
  industry_name: string;
  sector: string;
  description: string | null;
  source: string;
  active: boolean;
};

type SicIndustryMapRow = {
  sic_code: string;
  sic_description: string;
  industry_code: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
};

function normalizeSicCode(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function generateIndustryCode(sector: string, industry: string): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${clean(sector)}__${clean(industry)}`;
}

async function main() {
  console.log('🚀 Starting load-sic-industry-map...');

  try {
    console.log('Fetching FMP industry lists...');
    const [allIndustryList, allSicList] = await Promise.all([
      fmpGet<any[]>('/api/v3/all-industry-classification').catch(e => {
          console.warn('Failed to fetch all-industry-classification:', e.message);
          return [];
      }),
      fmpGet<any[]>('/api/v3/standard-industrial-classification-list').catch(e => {
          console.warn('Failed to fetch standard-industrial-classification-list:', e.message);
          return [];
      }),
    ]);

    console.log(`Fetched: allIndustryList=${Array.isArray(allIndustryList) ? allIndustryList.length : 0}, allSicList=${Array.isArray(allSicList) ? allSicList.length : 0}`);

    const industryMap = new Map<string, IndustryClassificationRow>();
    const sicCandidates = new Map<
      string,
      {
        sic_code: string;
        sic_description: string;
        industry_code: string;
        bestRank: number;
        variantCount: number;
      }
    >();

    const processNode = (node: RawIndustryNode, sourceList: string) => {
      const sector = (node.sector || '').toString().trim();
      const industry = (node.industry || '').toString().trim();
      
      if (!sector || !industry) return;
      if (sector === 'N/A' || industry === 'N/A') return;

      const industryCode = generateIndustryCode(sector, industry);
      
      if (!industryMap.has(industryCode)) {
        industryMap.set(industryCode, {
          industry_code: industryCode,
          industry_name: industry,
          sector: sector,
          description: null,
          source: 'fmp',
          active: true,
        });
      }

      const sicCode = normalizeSicCode(node.sicCode ?? (node as any).sic);
      if (sicCode) {
        const description = (node.subIndustry || industry).toString().trim();
        const rank = sourceList === 'sic_list' ? 2 : 1;

        const existing = sicCandidates.get(sicCode);
        if (!existing) {
          sicCandidates.set(sicCode, {
            sic_code: sicCode,
            sic_description: description,
            industry_code: industryCode,
            bestRank: rank,
            variantCount: 1,
          });
        } else {
          const sameIndustry = existing.industry_code === industryCode && existing.sic_description === description;
          if (!sameIndustry) {
            existing.variantCount += 1;
            if (rank > existing.bestRank) {
              existing.bestRank = rank;
              existing.industry_code = industryCode;
              existing.sic_description = description;
            } else if (rank === existing.bestRank && industryCode < existing.industry_code) {
              existing.industry_code = industryCode;
              existing.sic_description = description;
            }
          }
        }
      }
    };

    if (Array.isArray(allIndustryList)) {
      for (const node of allIndustryList) {
        processNode({
            sicCode: (node as any).sicCode ?? (node as any).sic,
            sector: (node as any).sector,
            industry: (node as any).industry,
            subIndustry: (node as any).subIndustry ?? (node as any).sub_industry,
        }, 'all_industry');
      }
    }

    if (Array.isArray(allSicList)) {
      for (const node of allSicList) {
         processNode({
            sicCode: (node as any).sicCode ?? (node as any).sic,
            sector: (node as any).sector,
            industry: (node as any).industry,
            subIndustry: (node as any).subIndustry ?? (node as any).sub_industry,
        }, 'sic_list');
      }
    }

    const industries = Array.from(industryMap.values());

    const { data: existingIndustries, error: industriesSelectError } = await supabaseAdmin
      .from('industry_classification')
      .select('industry_code');

    if (industriesSelectError) {
      console.error('Error loading existing industry_classification rows:', industriesSelectError.message);
      throw industriesSelectError;
    }

    const existingIndustryCodes = new Set(
      (existingIndustries || []).map((r: any) => String((r as any).industry_code)),
    );

    const industriesToInsert = industries.filter((row) => !existingIndustryCodes.has(row.industry_code));

    console.log(
      `Prepared industries: total=${industries.length}, new=${industriesToInsert.length}, existing=${existingIndustryCodes.size}`,
    );

    if (industriesToInsert.length > 0) {
      const { error } = await supabaseAdmin.from('industry_classification').insert(industriesToInsert);
      if (error) {
        console.error('Error inserting industries:', error.message);
        throw error;
      }
      console.log('Inserted industries:', industriesToInsert.length);
    }

    const sicMappings: SicIndustryMapRow[] = [];
    for (const candidate of sicCandidates.values()) {
      let confidence: 'high' | 'medium' | 'low';
      if (candidate.variantCount > 1) {
        confidence = 'low';
      } else if (candidate.bestRank >= 2) {
        confidence = 'high';
      } else {
        confidence = 'medium';
      }

      sicMappings.push({
        sic_code: candidate.sic_code,
        sic_description: candidate.sic_description,
        industry_code: candidate.industry_code,
        source: 'fmp',
        confidence,
      });
    }

    const { data: existingSicRows, error: sicSelectError } = await supabaseAdmin
      .from('sic_industry_map')
      .select('sic_code');

    if (sicSelectError) {
      console.error('Error loading existing sic_industry_map rows:', sicSelectError.message);
      throw sicSelectError;
    }

    const existingSicCodes = new Set((existingSicRows || []).map((r: any) => String((r as any).sic_code)));

    const sicToInsert = sicMappings.filter((row) => !existingSicCodes.has(row.sic_code));

    console.log(
      `Prepared SIC mappings: total=${sicMappings.length}, new=${sicToInsert.length}, existing=${existingSicCodes.size}`,
    );

    if (sicToInsert.length > 0) {
      const { error } = await supabaseAdmin.from('sic_industry_map').insert(sicToInsert);
      if (error) {
        console.error('Error inserting SIC mappings:', error.message);
        throw error;
      }
      console.log('Inserted SIC mappings:', sicToInsert.length);
    }

    console.log('Done.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
