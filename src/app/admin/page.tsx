"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  BookOpen,
  TrendingUp,
  Award,
  BarChart3,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout";
import { apiGet } from "@/lib/api-client";

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalCompletions: number;
  averageCompletionRate: number;
  activeUsersThisMonth: number;
  newUsersThisMonth: number;
}

const EMPTY_STATS: AdminStats = {
  totalUsers: 0,
  totalCourses: 0,
  totalEnrollments: 0,
  totalCompletions: 0,
  averageCompletionRate: 0,
  activeUsersThisMonth: 0,
  newUsersThisMonth: 0,
};

const formatNumber = (n: number) => n.toLocaleString("vi-VN");

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiGet<AdminStats>("/api/admin/stats");
        if (cancelled) return;
        if (res.success && res.data) {
          setStats(res.data);
        } else {
          setError(res.error ?? "Không thể tải thống kê");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching stats:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    {
      title: "Tổng người dùng",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      href: "/admin/users",
    },
    {
      title: "Tổng khóa học",
      value: stats.totalCourses,
      icon: BookOpen,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
      href: "/admin/courses",
    },
    {
      title: "Tổng đăng ký",
      value: stats.totalEnrollments,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      title: "Hoàn thành",
      value: stats.totalCompletions,
      icon: Award,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
  ];

  return (
    <PageContainer
      title="Bảng điều khiển quản trị"
      description="Tổng quan về hệ thống đào tạo"
      showBreadcrumb={false}
    >
      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="group">
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{formatNumber(stat.value)}</p>
                )}
              </div>
              {stat.href && (
                <Link href={stat.href} prefetch={false}>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && !isLoading && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Không thể tải thống kê: {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Thao tác nhanh</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/programs/new">
                <BookOpen className="mr-2 h-4 w-4" />
                Tạo chương trình mới
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/programs">
                <BookOpen className="mr-2 h-4 w-4" />
                Quản lý chương trình
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/assignments">
                <UserPlus className="mr-2 h-4 w-4" />
                Gán chương trình cho nhân viên
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Báo cáo tiến độ
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/users">
                <Users className="mr-2 h-4 w-4" />
                Quản lý người dùng
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Monthly Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Tổng quan tháng này</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Người dùng hoạt động
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className="font-semibold">
                  {formatNumber(stats.activeUsersThisMonth)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Người dùng mới
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <Badge variant="success">
                  +{formatNumber(stats.newUsersThisMonth)}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tỷ lệ hoàn thành
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className="font-semibold">
                  {stats.averageCompletionRate}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
