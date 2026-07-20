"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Users,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, useAuthStore } from "@/stores";
import type { UserRole } from "@/types";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Chương trình của tôi",
    href: "/dashboard/programs",
    icon: BookOpen,
  },
  {
    title: "Hồ sơ",
    href: "/profile",
    icon: Settings,
  },
];

const adminItems: NavItem[] = [
  {
    title: "Tổng quan",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    title: "Quản lý người dùng",
    href: "/admin/users",
    icon: Users,
    roles: ["admin", "manager", "hr"],
  },
  {
    title: "Chương trình",
    href: "/admin/programs",
    icon: BookOpen,
    roles: ["admin", "manager", "hr", "trainer"],
  },
  {
    title: "Gán chương trình",
    href: "/admin/assignments",
    icon: UserPlus,
    roles: ["admin", "manager", "hr"],
  },
  {
    title: "Báo cáo",
    href: "/admin/reports",
    icon: BarChart3,
    roles: ["admin", "manager", "hr"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarOpen, toggleSidebar, setSidebarOpen } =
    useUIStore();
  const { user } = useAuthStore();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role as UserRole)
  );

  const filteredAdminItems = adminItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role as UserRole)
  );

  const isActiveDesktop = (href: string) => {
    if (pathname === href) return true;
    if (href === "/dashboard") return false;
    if (href === "/admin") return false;
    return pathname.startsWith(href + "/");
  };

  const NavLink = ({
    item,
  }: {
    item: NavItem;
  }) => {
    const isActive = () => {
      if (pathname === item.href) return true;
      if (item.href === "/dashboard") return false;
      if (item.href === "/admin") return false;
      return pathname.startsWith(item.href + "/");
    };

    return (
      <Link
        href={item.href}
        prefetch={false}
        onClick={() => {
          if (window.innerWidth < 1024) {
            setSidebarOpen(false);
          }
        }}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive()
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-full flex-col border-r bg-card transition-all duration-300 lg:flex",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-4">
          {!sidebarCollapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">Epath Training</span>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
            >
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 no-scrollbar">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActiveDesktop(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate">{item.title}</span>
              )}
            </Link>
          ))}

          {filteredAdminItems.length > 0 && (
            <>
              <div className="my-4 px-3">
                {!sidebarCollapsed && (
                  <span className="truncate text-xs font-semibold uppercase text-muted-foreground">
                    Quản trị
                  </span>
                )}
                {sidebarCollapsed && (
                  <div className="mx-auto h-px w-8 bg-border" />
                )}
              </div>
              {filteredAdminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActiveDesktop(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn("w-full", sidebarCollapsed && "px-2")}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Thu gọn</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar — slides in as overlay when open */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-card transition-transform duration-300 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Epath Training</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-2 no-scrollbar">
          {filteredNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {filteredAdminItems.length > 0 && (
            <>
              <div className="my-4 px-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Quản trị
                </span>
              </div>
              {filteredAdminItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="w-full"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Đóng</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
