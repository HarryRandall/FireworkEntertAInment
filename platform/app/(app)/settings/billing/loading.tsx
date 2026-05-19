import { Card } from "@/app/components/ui/Card";
import { Skeleton } from "@/app/components/ui/Feedback";

export default function BillingSettingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading billing">
      <Card elevation="high" radius="md" className="space-y-4 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-72 max-w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-5/6 max-w-2xl" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <Card key={cardIndex} elevation="low" radius="md" className="space-y-4 p-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-full" />
            <ul className="space-y-3">
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <li key={rowIndex} className="flex items-start gap-2">
                  <Skeleton className="mt-1 h-3 w-3 rounded-sm" />
                  <Skeleton className="h-4 flex-1" />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
