import type { BelegungBuchungen, Hundekartei, PfotenPortraet } from './app';

export type EnrichedHundekartei = Hundekartei & {
  besitzerName: string;
};

export type EnrichedBelegungBuchungen = BelegungBuchungen & {
  hundName: string;
  besitzerName: string;
};

export type EnrichedPfotenPortraet = PfotenPortraet & {
  hundName: string;
  besitzerName: string;
};
