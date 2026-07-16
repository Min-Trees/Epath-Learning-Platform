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
    <div className={cn("p-4 lg:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {showBreadcrumb && <Breadcrumb items={breadcrumbs} />}
            {title && (
              <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
            )}
            {description && (
              <p className="text-muted-foreground text-sm lg:text-base">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
