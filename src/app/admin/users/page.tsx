"use client";

import { useState, useMemo, useCallback, useTransition, useEffect } from "react";
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
  LucideUser,
  Users,
  Building2,
  Filter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { PageContainer } from "@/components/layout";
import { useAuth, useCollection, useDebouncedValue, useDocMutation } from "@/hooks";
import { doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiPost } from "@/lib/api-client";
import { getInitials } from "@/utils";
import type { User, UserRole } from "@/types";
import type { Program } from "@/types/training";

interface CreateUserResponse {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Quản trị",
  manager: "Quản lý",
  hr: "Nhân sự",
  trainer: "Giảng viên",
  employee: "Nhân viên",
};

const ROLE_BADGE: Record<UserRole, "destructive" | "info" | "warning" | "secondary" | "default"> = {
  admin: "destructive",
  manager: "default",
  hr: "info",
  trainer: "warning",
  employee: "secondary",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [isPending, startTransition] = useTransition();

  // UI state
  const [searchInput, setSearchInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter by manager (for manager role)
  const [showOnlyMyTeam, setShowOnlyMyTeam] = useState(true);

  // Debounce search
  const debouncedSearch = useDebouncedValue(searchInput, 250);

  // React Query: fetch users
  const {
    data: users = [],
    isLoading,
    isFetching,
    refetch,
  } = useCollection<User & { id: string }>("users");

  // Get list of managers for dropdown
  const managers = useMemo(() => {
    return users.filter((u) => u.role === "manager");
  }, [users]);

  // Get manager's name by ID
  const getManagerName = useCallback((managerId?: string) => {
    if (!managerId) return "Không có";
    const manager = managers.find((m) => m.id === managerId);
    return manager?.displayName ?? managerId.slice(0, 8) + "...";
  }, [managers]);

  // Filter users based on role
  const isAdmin = currentUser?.role === "admin";
  const isManager = currentUser?.role === "manager";
  const currentUserId = currentUser?.id;

  const filteredUsers = useMemo(() => {
    let result = users;

    // Manager chỉ thấy nhân viên của họ (hoặc chính họ)
    if (isManager) {
      if (showOnlyMyTeam) {
        result = result.filter((u) => 
          u.id === currentUserId || u.managerId === currentUserId
        );
      }
    }

    // Filter by search
    const q = debouncedSearch.toLowerCase();
    if (q) {
      result = result.filter((u) => {
        const matchSearch =
          (u.displayName ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q);
        return matchSearch;
      });
    }

    // Filter by role (admin thấy tất cả, manager chỉ thấy employee)
    if (isAdmin && selectedRole !== "all") {
      result = result.filter((u) => u.role === selectedRole);
    } else if (isManager) {
      // Manager chỉ thấy employee hoặc chính họ
      if (selectedRole === "employee") {
        result = result.filter((u) => u.role === "employee");
      } else if (selectedRole === "all") {
        result = result.filter((u) => u.role === "employee" || u.id === currentUserId);
      }
    } else if (selectedRole !== "all") {
      result = result.filter((u) => u.role === selectedRole);
    }

    return result;
  }, [users, debouncedSearch, selectedRole, isAdmin, isManager, showOnlyMyTeam, currentUserId]);

  // Stats
  const stats = useMemo(() => {
    if (isManager) {
      const myEmployees = users.filter((u) => u.managerId === currentUserId);
      return {
        total: myEmployees.length,
        active: myEmployees.filter((u) => u.isActive).length,
        inactive: myEmployees.filter((u) => !u.isActive).length,
      };
    }
    return {
      total: users.filter((u) => u.role === "employee").length,
      active: users.filter((u) => u.role === "employee" && u.isActive).length,
      inactive: users.filter((u) => u.role === "employee" && !u.isActive).length,
    };
  }, [users, isManager, currentUserId]);

  // Mutation: update role
  const changeRole = useDocMutation<
    { target: User; role: UserRole },
    void
  >({
    mutationFn: async ({ target, role }) => {
      await import("firebase/firestore").then(({ updateDoc }) =>
        updateDoc(doc(db, "users", target.id), {
          role,
          updatedAt: serverTimestamp(),
        })
      );
    },
    invalidate: ["users"],
  });

  // Mutation: toggle active
  const toggleActive = useDocMutation<{ target: User }, void>({
    mutationFn: async ({ target }) => {
      const newActive = !target.isActive;
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", target.id), {
        isActive: newActive,
        updatedAt: serverTimestamp(),
      });
    },
    invalidate: ["users"],
  });

  // Mutation: delete
  const deleteUser = useDocMutation<{ target: User }, void>({
    mutationFn: async ({ target }) => {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "users", target.id));
    },
    invalidate: ["users"],
  });

  const handleChangeRole = useCallback(
    (target: User, role: UserRole) => {
      if (!currentUser) return;
      
      // Admin có thể đổi bất kỳ role nào
      // Manager chỉ có thể đổi role của nhân viên thuộc quyền quản lý
      if (!isAdmin && !isManager) {
        setError("Bạn không có quyền thay đổi vai trò.");
        return;
      }
      
      if (isManager && target.managerId !== currentUserId) {
        setError("Bạn chỉ có thể thay đổi vai trò của nhân viên thuộc quyền quản lý của bạn.");
        return;
      }
      
      if (target.id === currentUser.id && role !== "admin" && role !== "manager") {
        setError("Không thể tự hạ vai trò của chính mình.");
        return;
      }
      
      // Manager không thể tạo admin hoặc manager khác
      if (isManager && (role === "admin" || role === "manager")) {
        setError("Bạn không có quyền tạo Admin hoặc Manager khác.");
        return;
      }
      
      setActionId(target.id);
      setError(null);
      changeRole.mutate(
        { target, role },
        {
          onSuccess: () => {
            setSuccess(`Đã đổi vai trò "${target.displayName}" → ${ROLE_LABELS[role]}.`);
          },
          onError: (e) => setError(e instanceof Error ? e.message : String(e)),
          onSettled: () => setActionId(null),
        }
      );
    },
    [currentUser, isAdmin, isManager, currentUserId, changeRole]
  );

  const handleToggleActive = useCallback(
    (target: User) => {
      if (!currentUser) return;
      
      if (!isAdmin && !isManager) {
        setError("Bạn không có quyền.");
        return;
      }
      
      if (isManager && target.managerId !== currentUserId) {
        setError("Bạn chỉ có thể thay đổi trạng thái của nhân viên thuộc quyền quản lý của bạn.");
        return;
      }
      
      if (target.id === currentUser.id) {
        setError("Không thể tự vô hiệu hóa tài khoản của chính mình.");
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
    [currentUser, isAdmin, isManager, currentUserId, toggleActive]
  );

  const handleDeleteUser = useCallback(
    (target: User) => {
      if (!currentUser) return;
      
      if (!isAdmin) {
        setError("Chỉ Admin mới có quyền xóa người dùng.");
        return;
      }
      
      if (target.id === currentUser.id) {
        setError("Không thể tự xóa tài khoản của chính mình.");
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
    [currentUser, isAdmin, deleteUser]
  );

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "employee" as UserRole,
    department: "",
    managerId: "" as string,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Programs for assignment
  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());

  // Fetch programs when dialog opens
  useEffect(() => {
    if (!createOpen) return;
    const fetchPrograms = async () => {
      try {
        const res = await fetch("/api/programs", {
          headers: {
            Authorization: `Bearer ${await (await import("@/lib/firebase")).auth.currentUser?.getIdToken()}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.items) {
            setAvailablePrograms(
              (data.data.items as Program[]).filter((p) => p.status === "published")
            );
          }
        }
      } catch {
        // ignore
      }
    };
    void fetchPrograms();
  }, [createOpen]);

  // Set default manager for manager role
  useEffect(() => {
    if (isManager && !createForm.managerId) {
      setCreateForm((f) => ({ ...f, managerId: currentUserId ?? "" }));
    }
  }, [isManager, createForm.managerId, currentUserId]);

  const resetCreateForm = useCallback(() => {
    setCreateForm({
      email: "",
      password: "",
      displayName: "",
      role: "employee",
      department: "",
      managerId: isManager ? (currentUserId ?? "") : "",
    });
    setCreateError(null);
    setSelectedProgramIds(new Set());
  }, [isManager, currentUserId]);

  const openCreate = useCallback(() => {
    resetCreateForm();
    setCreateOpen(true);
  }, [resetCreateForm]);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateError(null);
    setSelectedProgramIds(new Set());
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
    
    // Manager chỉ có thể tạo employee
    if (isManager && createForm.role !== "employee") {
      setCreateError("Bạn chỉ có thể tạo tài khoản Nhân viên.");
      return;
    }
    
    // Manager phải chọn manager quản lý
    if (isManager && !createForm.managerId) {
      setCreateError("Phải chọn người quản lý cho nhân viên.");
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
        managerId: createForm.managerId || undefined,
        assignedProgramIds: Array.from(selectedProgramIds),
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Tạo người dùng thất bại");
      }
      setSuccess(
        `Đã tạo người dùng "${res.data.displayName}" (${res.data.email}).`
      );
      closeCreate();
      void refetch();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, closeCreate, refetch, selectedProgramIds, isManager]);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      void refetch();
    });
  }, [refetch]);

  const showLoading = isLoading && users.length === 0;

  // Can user perform actions on this target?
  const canManage = useCallback((target: User) => {
    if (isAdmin) return true;
    if (isManager && target.managerId === currentUserId) return true;
    return false;
  }, [isAdmin, isManager, currentUserId]);

  return (
    <PageContainer
      title={isManager ? "Quản lý nhân viên" : "Quản lý người dùng"}
      description={isManager ? "Quản lý và theo dõi nhân viên của bạn" : "Quản lý tài khoản và phân quyền người dùng"}
      breadcrumbs={[{ label: isManager ? "Nhân viên" : "Người dùng" }]}
      showBreadcrumb={false}
      actions={
        <div className="flex gap-2">
          {(isAdmin || isManager) && (
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isManager ? "Thêm nhân viên" : "Tạo người dùng"}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isManager ? "Nhân viên của tôi" : "Tổng nhân viên"}
                </p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Đang hoạt động</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <LucideUser className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Không hoạt động</p>
                <p className="text-3xl font-bold text-muted-foreground">{stats.inactive}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <LucideUser className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={isManager ? "Tìm nhân viên..." : "Tìm người dùng..."}
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {isManager ? (
            <>
              <Button
                variant={showOnlyMyTeam ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyMyTeam(true)}
              >
                <Users className="mr-1 h-4 w-4" />
                Nhân viên của tôi
              </Button>
              <Button
                variant={!showOnlyMyTeam ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnlyMyTeam(false)}
              >
                <Filter className="mr-1 h-4 w-4" />
                Tất cả
              </Button>
            </>
          ) : (
            (["all", "admin", "manager", "hr", "trainer", "employee"] as const).map(
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
            )
          )}
        </div>
      </div>

      {/* User Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Vai trò</TableHead>
                {isAdmin && <TableHead>Quản lý</TableHead>}
                <TableHead>Phòng ban</TableHead>
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
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    {isAdmin && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {users.length === 0
                      ? "Chưa có người dùng nào."
                      : isManager && showOnlyMyTeam
                        ? "Bạn chưa có nhân viên nào."
                        : "Không tìm thấy người dùng phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const busy = actionId === u.id;
                  const canAct = canManage(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={u.photoURL} alt={u.displayName} />
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
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE[u.role] ?? "secondary"}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">
                          {u.managerId ? (
                            <Badge variant="outline">{getManagerName(u.managerId)}</Badge>
                          ) : (
                            <span className="text-sm">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">
                        {u.department || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "success" : "secondary"}>
                          {u.isActive ? "Hoạt động" : "Khóa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!canAct || busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isAdmin && (
                              <>
                                {(["admin", "manager", "hr", "trainer", "employee"] as const)
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
                              </>
                            )}
                            {isManager && u.role === "employee" && (
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(u, "trainer")}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Nâng thành Giảng viên
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {u.isActive ? "Khóa tài khoản" : "Mở khóa"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => (window.location.href = `mailto:${u.email}`)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Gửi email
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(u)}
                                disabled={isSelf}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Xóa
                              </DropdownMenuItem>
                            )}
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
      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {isManager ? "Thêm nhân viên mới" : "Tạo người dùng mới"}
            </DialogTitle>
            <DialogDescription>
              {isManager
                ? "Tạo tài khoản nhân viên mới. Nhân viên sẽ được gán quản lý bởi bạn."
                : "Tạo tài khoản mới trong Firebase Auth và hồ sơ Firestore."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
            
            {/* Role selection - Manager chỉ thấy Employee */}
            <div className="grid gap-1.5">
              <Label htmlFor="cu-role">Vai trò</Label>
              {isAdmin ? (
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
                  <option value="manager">Quản lý</option>
                  <option value="trainer">Giảng viên</option>
                  <option value="hr">Nhân sự</option>
                  <option value="admin">Quản trị</option>
                </select>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                  <Badge variant="secondary">Nhân viên</Badge>
                  <span className="text-sm text-muted-foreground">
                    Bạn chỉ có thể tạo tài khoản Nhân viên
                  </span>
                </div>
              )}
            </div>

            {/* Manager selection */}
            <div className="grid gap-1.5">
              <Label htmlFor="cu-manager">
                <Building2 className="inline h-4 w-4 mr-1" />
                Người quản lý
              </Label>
              {isAdmin ? (
                <select
                  id="cu-manager"
                  value={createForm.managerId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, managerId: e.target.value }))
                  }
                  disabled={createLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Không có</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.email})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                  <Badge variant="default">
                    {managers.find((m) => m.id === currentUserId)?.displayName ?? "Bạn"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Nhân viên sẽ được gán quản lý bởi bạn
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cu-dept">Phòng ban</Label>
              <Input
                id="cu-dept"
                placeholder="VD: Kỹ thuật, Kinh doanh..."
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

            {/* Programs selection */}
            {availablePrograms.length > 0 && (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Chương trình đào tạo ({selectedProgramIds.size} đã chọn)</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setSelectedProgramIds(new Set())}
                    >
                      Bỏ chọn
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        setSelectedProgramIds(new Set(availablePrograms.map((p) => p.id)))
                      }
                    >
                      Chọn tất cả
                    </Button>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                  {availablePrograms.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedProgramIds.has(p.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProgramIds((s) => {
                            const ns = new Set(s);
                            if (checked) ns.add(p.id);
                            else ns.delete(p.id);
                            return ns;
                          });
                        }}
                      />
                      <span className="text-sm flex-1">{p.title}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Nhân viên sẽ được gán các chương trình đã chọn sau khi tạo.
                </p>
              </div>
            )}

            {createError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{createError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCreate} disabled={createLoading}>
              Hủy
            </Button>
            <Button onClick={handleCreateUser} disabled={createLoading}>
              {createLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {isManager ? "Thêm nhân viên" : "Tạo người dùng"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
