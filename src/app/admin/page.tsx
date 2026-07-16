"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  BookOpen,
  Award,
  TrendingUp,
  BarChart3,
  ArrowRight,
  FileText,
  FileQuestion,
  Trash2,
  UserPlus,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { myProgramsService, programService } from "@/services/training";

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalCompletions: number;
  averageCompletionRate: number;
  activeUsersThisMonth: number;
  newUsersThisMonth: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    totalCompletions: 0,
    averageCompletionRate: 0,
    activeUsersThisMonth: 0,
    newUsersThisMonth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        setStats({
          totalUsers: 245,
          totalCourses: 28,
          totalEnrollments: 1250,
          totalCompletions: 890,
          averageCompletionRate: 71,
          activeUsersThisMonth: 198,
          newUsersThisMonth: 15,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
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
      breadcrumbs={[{ label: "Quản trị" }]}
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
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
              </div>
              {stat.href && (
                <Link href={stat.href}>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/admin/cleanup">
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                <span className="text-destructive">Dọn dẹp dữ liệu</span>
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
                <span className="font-semibold">{stats.activeUsersThisMonth}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Người dùng mới
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <Badge variant="success">+{stats.newUsersThisMonth}</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tỷ lệ hoàn thành
              </span>
              {isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span className="font-semibold">{stats.averageCompletionRate}%</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
