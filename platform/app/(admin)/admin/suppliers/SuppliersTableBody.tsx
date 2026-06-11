'use client';

/** Optimistic supplier table body so deletions disappear before the server refresh completes. */

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { tableCellClasses, tableRowClasses } from '@/app/components/ui/DataTable';
import type { SupplierSummary } from '@/lib/admin.types';
import { SupplierRowActions } from './SupplierRowActions';

type Props = {
  suppliers: SupplierSummary[];
};

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'suspended':
      return 'danger' as const;
    case 'archived':
      return 'neutral' as const;
    default:
      return 'amber-soft' as const;
  }
}

export function SuppliersTableBody({ suppliers }: Props) {
  const [hiddenSupplierIds, setHiddenSupplierIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenSupplierIds(new Set());
  }, [suppliers]);

  const visibleSuppliers = useMemo(
    () => suppliers.filter((supplier) => !hiddenSupplierIds.has(supplier.id)),
    [hiddenSupplierIds, suppliers],
  );

  const hideSupplier = (id: string) => {
    setHiddenSupplierIds((current) => new Set(current).add(id));
  };

  const restoreSupplier = (id: string) => {
    setHiddenSupplierIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  return (
    <tbody>
      {visibleSuppliers.map((supplier) => {
        const supplierForActions = {
          id: supplier.id,
          name: supplier.name,
          contactEmail: supplier.contactEmail ?? '',
          phone: supplier.phone ?? undefined,
          websiteUrl: supplier.websiteUrl ?? '',
          status: (supplier.status as 'draft' | 'active' | 'suspended' | 'archived') ?? 'draft',
        };

        return (
          <tr key={supplier.id} className={tableRowClasses()}>
            <td
              className={tableCellClasses('font-medium text-[color:var(--color-content-emphasis)]')}
            >
              {supplier.name}
            </td>
            <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
              {supplier.contactEmail || '-'}
            </td>
            <td
              className={tableCellClasses(
                'font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums',
              )}
            >
              {supplier.phone || '-'}
            </td>
            <td className={tableCellClasses('text-[color:var(--color-content-subtle)]')}>
              {supplier.websiteUrl ? (
                <a
                  href={supplier.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-content-emphasis)]"
                >
                  {supplier.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                '-'
              )}
            </td>
            <td className={tableCellClasses()}>
              <Badge solid tone={statusTone(supplier.status)}>
                {supplier.status}
              </Badge>
            </td>
            <td className={tableCellClasses('text-right')}>
              <SupplierRowActions
                supplier={supplierForActions}
                onOptimisticDelete={hideSupplier}
                onDeleteFailed={restoreSupplier}
              />
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
