import { NarrativeAnchor, TemporalHint } from '@/lib/analysis/narrativeAnchors';
import { Locale } from './types';
import { NARRATIVE_EN } from './narrative.en';
import { NARRATIVE_ES } from './narrative.es';
import { NARRATIVE_PT } from './narrative.pt';

const MAP = {
  en: NARRATIVE_EN,
  es: NARRATIVE_ES,
  pt: NARRATIVE_PT,
};

const TEMPORAL_ES: Record<string, string> = {
  recent: 'reciente',
  persistent: 'persistente',
  fading: 'en retroceso',
};

const TEMPORAL_PT: Record<string, string> = {
  recent: 'recente',
  persistent: 'persistente',
  fading: 'em retrocesso',
};

export function resolveNarrativeText(
  anchor: NarrativeAnchor,
  locale: Locale
): string {
  return MAP[locale]?.[anchor.id] ?? anchor.label;
}

export function resolveTemporalHint(
  hint: TemporalHint,
  locale: Locale
): string {
  if (locale === 'es' && TEMPORAL_ES[hint]) {
    return TEMPORAL_ES[hint];
  }
  if (locale === 'pt' && TEMPORAL_PT[hint]) {
    return TEMPORAL_PT[hint];
  }
  return hint; // fallback to english (keys are english)
}
