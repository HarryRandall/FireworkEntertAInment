import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { Badge } from '@/components/design-system/Badge';
import { Card } from '@/components/design-system/Card';
import type { ImportReviewCheck } from '@/lib/import-review';

const checkPresentation = {
  pass: {
    icon: CheckCircle2,
    iconClass: 'text-[color:var(--color-status-success)]',
    label: 'Passed',
    tone: 'success' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-[color:var(--color-status-warning)]',
    label: 'Review',
    tone: 'warning' as const,
  },
  blocker: {
    icon: XCircle,
    iconClass: 'text-destructive',
    label: 'Blocked',
    tone: 'danger' as const,
  },
  info: {
    icon: CircleHelp,
    iconClass: 'text-[color:var(--color-status-info)]',
    label: 'No evidence',
    tone: 'info' as const,
  },
};

export function ImportValidationPanel({ checks }: { checks: ImportReviewCheck[] }) {
  const blockers = checks.filter((check) => check.status === 'blocker').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Validation evidence</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Deterministic checks are separate from model confidence and AI ranking signals.
          </p>
        </div>
        <Badge solid tone={blockers > 0 ? 'danger' : warnings > 0 ? 'warning' : 'success'}>
          {blockers > 0
            ? `${blockers} ${blockers === 1 ? 'blocker' : 'blockers'}`
            : warnings > 0
              ? `${warnings} ${warnings === 1 ? 'review item' : 'review items'}`
              : 'Ready for review'}
        </Badge>
      </div>
      <ul className="border-border mt-4 divide-y rounded-lg border">
        {checks.map((check) => {
          const presentation = checkPresentation[check.status];
          const Icon = presentation.icon;
          return (
            <li key={check.id} className="flex items-start gap-3 p-3.5">
              <Icon
                size={18}
                className={`mt-0.5 shrink-0 ${presentation.iconClass}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-foreground text-sm font-medium">{check.label}</p>
                  <Badge tone={presentation.tone}>{presentation.label}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{check.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
