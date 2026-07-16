"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items;

    const paths = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    let currentPath = "";
    for (const path of paths) {
      currentPath += `/${path}`;

      let label = path
        .replace(/-/g, " ")
        .replace(/\[.*\]/, "")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      if (path.startsWith("[") && path.endsWith("]")) {
        label = "Chi tiết";
      }

      breadcrumbs.push({
        label,
        href: paths.indexOf(path) < paths.length - 1 ? currentPath : undefined,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center hover:text-foreground"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "font-medium text-foreground",
                  !item.href && "text-foreground"
                )}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
