import type { PfotenPortraet, Hundekartei, Besitzer } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface PfotenPortraetViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: PfotenPortraet | null;
  onEdit: (record: PfotenPortraet) => void;
  hundekarteiList: Hundekartei[];
  besitzerList: Besitzer[];
}

export function PfotenPortraetViewDialog({ open, onClose, record, onEdit, hundekarteiList, besitzerList }: PfotenPortraetViewDialogProps) {
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
          <DialogTitle>{t('view_entity', { entity: appLabel('pfoten_portraet') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'hund')}</Label>
            <p className="text-sm">{getHundekarteiDisplayName(record.fields.hund)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'besitzer')}</Label>
            <p className="text-sm">{getBesitzerDisplayName(record.fields.besitzer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'titel')}</Label>
            <p className="text-sm">{record.fields.titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'widmung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.widmung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'charakterbeschreibung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.charakterbeschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'lieblingsaktivitaet')}</Label>
            <p className="text-sm">{record.fields.lieblingsaktivitaet ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'besondere_momente')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.besondere_momente ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'portraet_foto')}</Label>
            {record.fields.portraet_foto ? (
              <MediaThumbnail src={record.fields.portraet_foto} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('pfoten_portraet', 'erstellungsdatum')}</Label>
            <p className="text-sm">{formatDate(record.fields.erstellungsdatum)}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.PFOTEN_PORTRAET} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}