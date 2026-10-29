import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { AnimalStatus } from '@/lib/api/types';
import { cn } from '@/lib/utils';

// Lifecycle → status token (see docs/design/tokens.css): green while the
// animal is in the herd, tan when it left normally, mustard/terracotta for
// culled/dead.
const STATUS_CLASSES: Record<AnimalStatus, string> = {
  active: 'bg-status-active/15 text-status-active border-status-active/30',
  sold: 'bg-status-inactive/15 text-status-inactive border-status-inactive/40',
  transferred:
    'bg-status-inactive/15 text-status-inactive border-status-inactive/40',
  culled: 'bg-status-warning/15 text-status-warning border-status-warning/40',
  dead: 'bg-status-danger/15 text-status-danger border-status-danger/40',
};

export function StatusBadge({ status }: { status: AnimalStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_CLASSES[status])}>
      {t(`vocab.status.${status}`)}
    </Badge>
  );
}
