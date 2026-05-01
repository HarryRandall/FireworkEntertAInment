import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AppPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function AppPageHeader({
  title,
  className,
}: AppPageHeaderProps) {
  return (
    <header
      className={cn(
        "-mx-6 border-b border-outline-variant/55 px-6 pb-1 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12",
        className,
      )}
    >
      <h1 className="min-w-0 text-3xl font-extrabold leading-none tracking-tight text-on-surface sm:text-4xl">
        {title}
      </h1>
    </header>
  );
}
