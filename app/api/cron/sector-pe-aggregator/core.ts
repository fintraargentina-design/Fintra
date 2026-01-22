import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';

type SectorPeSnapshotRow = {
  sector: string;
  pe?: number | string | null;
};

type SectorPeAggregatorResult = {
  ok: boolean;
  date: string | null;
  processed: number;
  errors: string[];
};

function getTargetDate(): string {
  const today = new Date();
  const day = today.getDay();

  if (day === 0) {
    today.setDate(today.getDate() - 2);
  } else if (day === 6) {
    today.setDate(today.getDate() - 1);
  }

  return today.toISOString().slice(0, 10);
}

function parsePe(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function runSectorPeAggregator(): Promise<SectorPeAggregatorResult> {
  const errors: string[] = [];
  const date = getTargetDate();

  try {
    const rows = await fmpGet<SectorPeSnapshotRow[]>(
      '/stable/sector-pe-snapshot',
      { date },
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        ok: true,
        date,
        processed: 0,
        errors,
      };
    }

    const upserts: {
      sector: string;
      pe_date: string;
      pe: number | null;
      source: string;
    }[] = [];

    for (const row of rows) {
      const sector = (row.sector || '').toString().trim();
      if (!sector) continue;

      const pe = parsePe(row.pe ?? null);

      upserts.push({
        sector,
        pe_date: date,
        pe,
        source: 'fmp_sector_pe_snapshot',
      });
    }

    if (!upserts.length) {
      return {
        ok: true,
        date,
        processed: 0,
        errors,
      };
    }

    const { error } = await supabaseAdmin
      .from('sector_pe')
      .upsert(upserts, {
        onConflict: 'sector,pe_date',
      });

    if (error) {
      errors.push(`Upsert error: ${error.message || String(error)}`);
      return {
        ok: false,
        date,
        processed: upserts.length,
        errors,
      };
    }

    return {
      ok: true,
      date,
      processed: upserts.length,
      errors,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[sector-pe-aggregator] Error fetching snapshot:', msg);
    errors.push(msg);

    return {
      ok: false,
      date,
      processed: 0,
      errors,
    };
  }
}

