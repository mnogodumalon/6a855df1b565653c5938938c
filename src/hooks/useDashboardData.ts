import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Besitzer, Hundekartei, BelegungBuchungen, Buchungsanfragen, PfotenPortraet, WebsiteInhalte } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
export function useDashboardData() {
  const [besitzer, setBesitzer] = useState<Besitzer[]>([]);
  const [hundekartei, setHundekartei] = useState<Hundekartei[]>([]);
  const [belegungBuchungen, setBelegungBuchungen] = useState<BelegungBuchungen[]>([]);
  const [buchungsanfragen, setBuchungsanfragen] = useState<Buchungsanfragen[]>([]);
  const [pfotenPortraet, setPfotenPortraet] = useState<PfotenPortraet[]>([]);
  const [websiteInhalte, setWebsiteInhalte] = useState<WebsiteInhalte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [besitzerData, hundekarteiData, belegungBuchungenData, buchungsanfragenData, pfotenPortraetData, websiteInhalteData] = await Promise.all([
        LivingAppsService.getBesitzer(),
        LivingAppsService.getHundekartei(),
        LivingAppsService.getBelegungBuchungen(),
        LivingAppsService.getBuchungsanfragen(),
        LivingAppsService.getPfotenPortraet(),
        LivingAppsService.getWebsiteInhalte(),
      ]);
      setBesitzer(besitzerData);
      setHundekartei(hundekarteiData);
      setBelegungBuchungen(belegungBuchungenData);
      setBuchungsanfragen(buchungsanfragenData);
      setPfotenPortraet(pfotenPortraetData);
      setWebsiteInhalte(websiteInhalteData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [besitzerData, hundekarteiData, belegungBuchungenData, buchungsanfragenData, pfotenPortraetData, websiteInhalteData] = await Promise.all([
          LivingAppsService.getBesitzer(),
          LivingAppsService.getHundekartei(),
          LivingAppsService.getBelegungBuchungen(),
          LivingAppsService.getBuchungsanfragen(),
          LivingAppsService.getPfotenPortraet(),
          LivingAppsService.getWebsiteInhalte(),
        ]);
        setBesitzer(besitzerData);
        setHundekartei(hundekarteiData);
        setBelegungBuchungen(belegungBuchungenData);
        setBuchungsanfragen(buchungsanfragenData);
        setPfotenPortraet(pfotenPortraetData);
        setWebsiteInhalte(websiteInhalteData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const besitzerMap = useMemo(() => {
    const m = new Map<string, Besitzer>();
    besitzer.forEach(r => m.set(r.record_id, r));
    return m;
  }, [besitzer]);

  const hundekarteiMap = useMemo(() => {
    const m = new Map<string, Hundekartei>();
    hundekartei.forEach(r => m.set(r.record_id, r));
    return m;
  }, [hundekartei]);

  return { besitzer, setBesitzer, hundekartei, setHundekartei, belegungBuchungen, setBelegungBuchungen, buchungsanfragen, setBuchungsanfragen, pfotenPortraet, setPfotenPortraet, websiteInhalte, setWebsiteInhalte, loading, error, fetchAll, besitzerMap, hundekarteiMap };
}