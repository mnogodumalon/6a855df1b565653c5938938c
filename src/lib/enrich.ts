import type { EnrichedBelegungBuchungen, EnrichedHundekartei, EnrichedPfotenPortraet } from '@/types/enriched';
import type { BelegungBuchungen, Besitzer, Hundekartei, PfotenPortraet } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface HundekarteiMaps {
  besitzerMap: Map<string, Besitzer>;
}

export function enrichHundekartei(
  hundekartei: Hundekartei[],
  maps: HundekarteiMaps
): EnrichedHundekartei[] {
  return hundekartei.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}

interface BelegungBuchungenMaps {
  hundekarteiMap: Map<string, Hundekartei>;
  besitzerMap: Map<string, Besitzer>;
}

export function enrichBelegungBuchungen(
  belegungBuchungen: BelegungBuchungen[],
  maps: BelegungBuchungenMaps
): EnrichedBelegungBuchungen[] {
  return belegungBuchungen.map(r => ({
    ...r,
    hundName: resolveDisplay(r.fields.hund, maps.hundekarteiMap, 'name'),
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}

interface PfotenPortraetMaps {
  hundekarteiMap: Map<string, Hundekartei>;
  besitzerMap: Map<string, Besitzer>;
}

export function enrichPfotenPortraet(
  pfotenPortraet: PfotenPortraet[],
  maps: PfotenPortraetMaps
): EnrichedPfotenPortraet[] {
  return pfotenPortraet.map(r => ({
    ...r,
    hundName: resolveDisplay(r.fields.hund, maps.hundekarteiMap, 'name'),
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}
