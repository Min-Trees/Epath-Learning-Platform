"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Shield, Calendar, Key, Loader2, CheckCircle2 } from "lucide-react";
import { apiPost } from "@/lib/api-client";

export default function ProfilePage() {
  const { user } = useAuthStore();

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }
    if (!newPassword) {
      setPasswordError("Vui lòng nhập mật khẩu mới");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới tối thiểu 6 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu mới không khớp");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiPost("/api/auth/change-password", { newPassword });
      if (res.success) {
        setPasswordSuccess("Đổi mật khẩu thành công!");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPasswordError((res as { error?: string }).error ?? "Lỗi đổi mật khẩu");
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Lỗi đổi mật khẩu");
    } finally {
      setIsChangingPassword(false);
    }
  }, [passwordForm]);

  const roleLabels: Record<string, string> = {
    admin: "Quản trị viên",
    manager: "Quản lý",
    hr: "Nhân sự",
    trainer: "Giảng viên",
    employee: "Nhân viên",
  };

  const initials = user?.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-3xl font-bold">Hồ sơ cá nhân</h1>

      {passwordError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{passwordError}</AlertDescription>
        </Alert>
      )}
      {passwordSuccess && (
        <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <AlertDescription>{passwordSuccess}</AlertDescription>
        </Alert>
      )}

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

      {/* Change Password */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Đổi mật khẩu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Nhập mật khẩu hiện tại"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                }
                disabled={isChangingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                }
                disabled={isChangingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
                }
                disabled={isChangingPassword}
              />
            </div>

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Đổi mật khẩu
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

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
