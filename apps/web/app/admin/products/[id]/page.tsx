/** Authorised catalogue product details and immutable history. */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { requireArea } from '@/lib/auth/server';
import { loadProductDetail } from '@/lib/catalogue/details';
import { Badge } from '@/ui/kit/feedback';
import { CatalogueControls } from '../../_components/catalogue-controls';
import { CataloguePoster } from '../../_components/catalogue-poster';
import { DetailSection, UsageList, VersionHistory } from '../../_components/catalogue-detail';

/** Loads one UUID parent, returning a real not-found response for missing catalogue records. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requireArea('admin');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const item = await loadProductDetail(id);
  if (!item) notFound();
  const preview =
    item.versions.find(
      (row) => row.id === (item.parent.draft_version_id ?? item.parent.current_version_id),
    )?.preview ?? null;
  const facts = [
    ['Kind', item.parent.kind],
    ['Brand', item.parent.brand ?? 'Not recorded'],
    ['Shots', item.parent.shot_count ?? 'Not published'],
    [
      'Safety confirmation',
      item.parent.safety_confirmed_at !== null ? 'Confirmed' : 'Required before publication',
    ],
  ];
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-3">
        <Link href="/admin/products" className="text-muted-foreground text-sm underline">
          Back to products
        </Link>
        <h1 className="text-2xl font-semibold">{item.parent.name}</h1>
        <CatalogueControls
          kind="product"
          pack={item.parent.kind === 'pack'}
          id={id}
          draftId={item.parent.draft_version_id}
          archived={item.parent.status === 'archived'}
          editable={['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? '')}
        />
      </header>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <DetailSection title="Preview">
          <CataloguePoster preview={preview} />
        </DetailSection>
        <DetailSection title="Status">
          <Badge>{item.parent.status}</Badge>
          <dl className="grid gap-3">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      </div>
      <DetailSection title="Used in">
        <UsageList rows={item.usage} />
      </DetailSection>
      <DetailSection title="Pack contents">
        <UsageList rows={item.contents} />
      </DetailSection>
      <VersionHistory versions={item.versions} />
    </div>
  );
}
