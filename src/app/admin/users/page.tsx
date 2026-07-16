"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Loader2,
  RefreshCw,
  Shield,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/layout";
import { useAuth, useCollection, useDebouncedValue, useDocMutation } from "@/hooks";
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiPost } from "@/lib/api-client";
import { getInitials } from "@/utils";
import type { User, UserRole } from "@/types";

interface CreateUserResponse {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Quản trị",
  hr: "Nhân sự",
  trainer: "Giảng viên",
  employee: "Nhân viên",
};

const ROLE_BADGE: Record<UserRole, "destructive" | "info" | "warning" | "secondary"> = {
  admin: "destructive",
  hr: "info",
  trainer: "warning",
  employee: "secondary",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [isPending, startTransition] = useTransition();

  // UI state (không liên quan đến data)
  const [searchInput, setSearchInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debounce search 250ms — tránh filter mỗi keystroke gây re-render
  const debouncedSearch = useDebouncedValue(searchInput, 250);

  // React Query: fetch users từ cache, dedupe, không flash khi chuyển tab
  const {
    data: users = [],
    isLoading,
    isFetching,
    refetch,
  } = useCollection<User & { id: string }>("users");

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return users.filter((u) => {
      const matchSearch =
        q === "" ||
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q);
      const matchRole = selectedRole === "all" || u.role === selectedRole;
      return matchSearch && matchRole;
    });
  }, [users, debouncedSearch, selectedRole]);

  // Mutation: update role — optimistic update
  const changeRole = useDocMutation<
    { target: User; role: UserRole },
    void
  >({
    mutationFn: async ({ target, role }) => {
      await import("firebase/firestore").then(({ updateDoc }) =>
        updateDoc(doc(db, target.id), {
          role,
          updatedAt: serverTimestamp(),
        })
      );
    },
    invalidate: ["users"],
  });

  // Mutation: toggle active — optimistic
  const toggleActive = useDocMutation<{ target: User }, void>({
    mutationFn: async ({ target }) => {
      const newActive = !target.isActive;
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, target.id), {
        isActive: newActive,
        updatedAt: serverTimestamp(),
      });
    },
    invalidate: ["users"],
  });

  // Mutation: delete — optimistic
  const deleteUser = useDocMutation<{ target: User }, void>({
    mutationFn: async ({ target }) => {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, target.id));
    },
    invalidate: ["users"],
  });

  const handleChangeRole = useCallback(
    (target: User, role: UserRole) => {
      if (!currentUser || currentUser.role !== "admin") {
        setError("Chỉ admin mới có quyền.");
        return;
      }
      if (target.id === currentUser.id && role !== "admin") {
        setError("Không thể tự hạ quyền admin của chính mình.");
        return;
      }
      setActionId(target.id);
      setError(null);
      changeRole.mutate(
        { target, role },
        {
          onSuccess: () => {
            setSuccess(`Đã đổi quyền "${target.displayName}" → ${ROLE_LABELS[role]}.`);
          },
          onError: (e) => setError(e instanceof Error ? e.message : String(e)),
          onSettled: () => setActionId(null),
        }
      );
    },
    [currentUser, changeRole]
  );

  const handleToggleActive = useCallback(
    (target: User) => {
      if (!currentUser || currentUser.role !== "admin") {
        setError("Chỉ admin mới có quyền.");
        return;
      }
      if (target.id === currentUser.id) {
        setError("Không thể tự vô hiệu hóa tài khoản admin.");
        return;
      }
      setActionId(target.id);
      setError(null);
      toggleActive.mutate(
        { target },
        {
          onSuccess: () => {
            const newActive = !target.isActive;
            setSuccess(
              `Đã ${newActive ? "kích hoạt" : "vô hiệu hóa"} "${target.displayName}".`
            );
          },
          onError: (e) => setError(e instanceof Error ? e.message : String(e)),
          onSettled: () => setActionId(null),
        }
      );
    },
    [currentUser, toggleActive]
  );

  const handleDeleteUser = useCallback(
    (target: User) => {
      if (!currentUser || currentUser.role !== "admin") {
        setError("Chỉ admin mới có quyền.");
        return;
      }
      if (target.id === currentUser.id) {
        setError("Không thể tự xóa tài khoản admin.");
        return;
      }
      if (!window.confirm(`Xóa người dùng "${target.displayName}" (${target.email})?\nKhông thể khôi phục.`)) return;
      setActionId(target.id);
      setError(null);
      deleteUser.mutate(
        { target },
        {
          onSuccess: () => setSuccess(`Đã xóa "${target.displayName}".`),
          onError: (e) => setError(e instanceof Error ? e.message : String(e)),
          onSettled: () => setActionId(null),
        }
      );
    },
    [currentUser, deleteUser]
  );

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "employee" as UserRole,
    department: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      email: "",
      password: "",
      displayName: "",
      role: "employee",
      department: "",
    });
    setCreateError(null);
  }, []);

  const openCreate = useCallback(() => {
    resetCreateForm();
    setCreateOpen(true);
  }, [resetCreateForm]);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateError(null);
  }, []);

  const handleCreateUser = useCallback(async () => {
    setCreateError(null);
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;
    const displayName = createForm.displayName.trim();
    if (!email || !email.includes("@")) {
      setCreateError("Email không hợp lệ.");
      return;
    }
    if (!password || password.length < 6) {
      setCreateError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }
    if (!displayName) {
      setCreateError("Tên hiển thị không được để trống.");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await apiPost<CreateUserResponse>("/api/admin/users", {
        email,
        password,
        displayName,
        role: createForm.role,
        department: createForm.department.trim() || undefined,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Tạo người dùng thất bại");
      }
      setSuccess(
        `Đã tạo người dùng "${res.data.displayName}" (${res.data.email}).`
      );
      closeCreate();
      // Refresh ngay để thấy user mới
      void refetch();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, closeCreate, refetch]);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      void refetch();
    });
  }, [refetch]);

  const isAdmin = currentUser?.role === "admin";
  const showLoading = isLoading && users.length === 0;

  return (
    <PageContainer
      title="Quản lý người dùng"
      description="Quản lý tài khoản và phân quyền người dùng"
      breadcrumbs={[{ label: "Quản trị", href: "/admin" }, { label: "Người dùng" }]}
      actions={
        <div className="flex gap-2">
          {isAdmin && (
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Tạo người dùng
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm người dùng..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "admin", "hr", "trainer", "employee"] as const).map(
            (role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(role)}
              >
                {role === "all" ? "Tất cả" : ROLE_LABELS[role]}
              </Button>
            )
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Khóa học</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="mt-1 h-3 w-40" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {users.length === 0
                      ? "Chưa có người dùng nào."
                      : "Không tìm thấy người dùng phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const busy = actionId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={u.photoURL}
                              alt={u.displayName}
                            />
                            <AvatarFallback>
                              {getInitials(u.displayName ?? u.email ?? "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{u.displayName}</p>
                              {isSelf && (
                                <Badge variant="outline" className="text-xs">
                                  Bạn
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE[u.role] ?? "secondary"}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.department || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {(u.completedCourses ?? []).length}/
                          {(u.enrolledCourses ?? []).length}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "success" : "secondary"}>
                          {u.isActive ? "Hoạt động" : "Không hoạt động"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!isAdmin || busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(["admin", "hr", "trainer", "employee"] as const)
                              .filter((r) => r !== u.role)
                              .map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() => handleChangeRole(u, r)}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Đổi thành {ROLE_LABELS[r]}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(u)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {u.isActive ? "Vô hiệu hóa" : "Kích hoạt"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `mailto:${u.email}`)
                              }
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Gửi email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(u)}
                              disabled={isSelf}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog tạo người dùng mới */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => !o && closeCreate()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Tạo người dùng mới
            </DialogTitle>
            <DialogDescription>
              Tạo tài khoản mới trong Firebase Auth và hồ sơ Firestore.
              Người dùng có thể đăng nhập ngay bằng email + mật khẩu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cu-email">Email *</Label>
              <Input
                id="cu-email"
                type="email"
                placeholder="user@company.com"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
                disabled={createLoading}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-password">Mật khẩu *</Label>
              <Input
                id="cu-password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
                disabled={createLoading}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                User có thể đổi mật khẩu sau khi đăng nhập.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cu-name">Tên hiển thị *</Label>
              <Input
                id="cu-name"
                placeholder="Nguyễn Văn A"
                value={createForm.displayName}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    displayName: e.target.value,
                  }))
                }
                disabled={createLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cu-role">Vai trò</Label>
                <select
                  id="cu-role"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      role: e.target.value as UserRole,
                    }))
                  }
                  disabled={createLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="employee">Nhân viên</option>
                  <option value="trainer">Giảng viên</option>
                  <option value="hr">Nhân sự</option>
                  <option value="admin">Quản trị</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cu-dept">Phòng ban</Label>
                <Input
                  id="cu-dept"
                  placeholder="VD: Kỹ thuật"
                  value={createForm.department}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      department: e.target.value,
                    }))
                  }
                  disabled={createLoading}
                />
              </div>
            </div>

            {createError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {createError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCreate}
              disabled={createLoading}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createLoading}
            >
              {createLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo người dùng
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}