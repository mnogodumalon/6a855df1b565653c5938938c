import type { BelegungBuchungen, Hundekartei, Besitzer } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface BelegungBuchungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: BelegungBuchungen | null;
  onEdit: (record: BelegungBuchungen) => void;
  hundekarteiList: Hundekartei[];
  besitzerList: Besitzer[];
}

export function BelegungBuchungenViewDialog({ open, onClose, record, onEdit, hundekarteiList, besitzerList }: BelegungBuchungenViewDialogProps) {
  function getHundekarteiDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return hundekarteiList.find(r => r.record_id === id)?.fields.name ?? '—';
  }

  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return besitzerList.find(r => r.record_id === id)?.fields.vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('belegung_buchungen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'hund')}</Label>
            <p className="text-sm">{getHundekarteiDisplayName(record.fields.hund)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'besitzer')}</Label>
            <p className="text-sm">{getBesitzerDisplayName(record.fields.besitzer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'anreisedatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.anreisedatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'abreisedatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.abreisedatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'platznummer')}</Label>
            <Badge variant="secondary">{lookupLabel('belegung_buchungen', 'platznummer', record.fields.platznummer?.key) ?? record.fields.platznummer?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'status')}</Label>
            <Badge variant="secondary">{lookupLabel('belegung_buchungen', 'status', record.fields.status?.key) ?? record.fields.status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'preis_euro')}</Label>
            <p className="text-sm">{record.fields.preis_euro ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('belegung_buchungen', 'notizen')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.notizen ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.BELEGUNG_BUCHUNGEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}