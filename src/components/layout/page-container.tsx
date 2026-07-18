"use client";

import { ReactNode } from "react";
import { cn } from "@/utils";
import { Breadcrumb } from "./breadcrumb";

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  showBreadcrumb?: boolean;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageContainer({
  children,
  title,
  description,
  actions,
  className,
  showBreadcrumb = true,
  breadcrumbs,
}: PageContainerProps) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {showBreadcrumb && <Breadcrumb items={breadcrumbs} />}
            {title && (
              <h1 className="text-lg font-bold tracking-tight sm:text-xl lg:text-2xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm lg:text-base">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
