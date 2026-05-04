import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type Width = "default" | "wide" | "fluid";

const widthClasses: Record<Width, string> = {
  default: "max-w-[1200px]",
  wide: "max-w-[1400px]",
  fluid: "max-w-[1600px]",
};

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  width?: Width;
};

export function Container({
  width = "default",
  className,
  children,
  ...rest
}: ContainerProps) {
  return (
    <div
      className={cn(
        widthClasses[width],
        "mx-auto w-full px-6 lg:px-12",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
