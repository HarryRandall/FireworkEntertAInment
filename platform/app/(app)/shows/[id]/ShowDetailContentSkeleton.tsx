import {
  ListSkeleton,
  ReplayPanelSkeleton,
  ShoppingListSkeleton,
  SongContextSkeleton,
} from '@/app/components/app/RouteSkeletons';

export function ShowDetailContentSkeleton({ segment }: { segment: string | undefined }) {
  switch (segment) {
    case 'shopping-list':
      return <ShoppingListSkeleton />;
    case 'show-guide':
      return (
        <div className="max-w-3xl">
          <ListSkeleton rows={8} />
        </div>
      );
    case 'timeline':
      return <SongContextSkeleton />;
    case 'preview':
    default:
      return <ReplayPanelSkeleton />;
  }
}
