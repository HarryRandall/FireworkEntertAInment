"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <span className="cn-toast-icon cn-toast-icon-success">
            <CheckIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        ),
        info: (
          <span className="cn-toast-icon cn-toast-icon-info">
            <InfoIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        ),
        warning: (
          <span className="cn-toast-icon cn-toast-icon-warning">
            <TriangleAlertIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        ),
        error: (
          <span className="cn-toast-icon cn-toast-icon-error">
            <XIcon className="size-3.5" strokeWidth={2.5} />
          </span>
        ),
        loading: (
          <span className="cn-toast-icon cn-toast-icon-info">
            <Loader2Icon className="size-3.5 animate-spin" />
          </span>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-bg-elevated, var(--popover))",
          "--normal-text": "var(--color-content-emphasis, var(--popover-foreground))",
          "--normal-border": "var(--color-border-default, var(--border))",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          title: "cn-toast-title",
          description: "cn-toast-description",
          closeButton: "cn-toast-close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
