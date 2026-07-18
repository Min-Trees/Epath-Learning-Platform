"use client";

import { useAuthStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Quản trị viên",
    hr: "Nhân sự",
    trainer: "Giảng viên",
    employee: "Nhân viên",
  };

  const initials = user.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-3xl font-bold">Hồ sơ cá nhân</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Avatar & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={user.photoURL || ""} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            
            <h2 className="text-xl font-semibold">{user.displayName}</h2>
            <p className="text-muted-foreground">{user.email}</p>
            
            <Badge variant="secondary" className="mt-2">
              {roleLabels[user.role] || user.role}
            </Badge>

            <div className="mt-6 w-full space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{user.displayName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{user.role}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Chỉnh sửa hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Họ tên</Label>
                <Input
                  id="displayName"
                  defaultValue={user.displayName || ""}
                  placeholder="Nhập họ tên"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Phòng ban</Label>
                <Input
                  id="department"
                  placeholder="Nhập phòng ban"
                />
              </div>

              <Button className="w-full">Lưu thay đổi</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Account Stats */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Thống kê tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{user.enrolledCourses?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Khóa học đã ghi danh</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{user.completedCourses?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Khóa học hoàn thành</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <Calendar className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Ngày tham gia</p>
              <p className="text-sm font-medium">-</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
