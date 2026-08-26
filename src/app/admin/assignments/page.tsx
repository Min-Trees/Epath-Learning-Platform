"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  Users,
  BookOpen,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  UsersRound,
  Filter,
  X,
  ListFilter,
  GraduationCap,
  LayoutGrid,
  List,
  UserX,
  UserPlus,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assignmentService, programService } from "@/services/training";
import { apiPut } from "@/lib/api-client";
import { getInitials } from "@/utils";
import type { Program, Assignment } from "@/types/training";
import type { User } from "@/types";

type ViewMode = "programs" | "employees";
type StatusFilter = "all" | "not_started" | "in_progress" | "completed";

export default function AdminAssignmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải...</div>}>
      <AdminAssignmentsPageInner />
    </Suspense>
  );
}

// Employee Item in Program View
function EmployeeItem({
  employee,
  programAssigns,
  program,
  onUnassign,
  selectedItems,
  onToggleSelect,
}: {
  employee: User;
  programAssigns: Assignment[];
  program: Program;
  onUnassign: (userId: string, programId: string) => void;
  selectedItems: Set<string>;
  onToggleSelect: (key: string) => void;
}) {
  const assignment = programAssigns.find((a) => a.userId === employee.id);
  const key = `${employee.id}_${program.id}`;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox
          checked={selectedItems.has(key)}
          onCheckedChange={() => onToggleSelect(key)}
          className="shrink-0"
        />
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={employee.photoURL} />
          <AvatarFallback className="text-xs">
            {getInitials(employee.displayName ?? "U")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{employee.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{employee.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {assignment && (
          <>
            <Badge
              variant={
                assignment.status === "completed"
                  ? "success"
                  : assignment.status === "in_progress"
                  ? "warning"
                  : "secondary"
              }
              className="text-xs hidden sm:inline-flex"
            >
              {assignment.status === "completed"
                ? "Hoàn thành"
                : assignment.status === "in_progress"
                ? "Đang học"
                : "Chưa học"}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              {assignment.assignedAt
                ? new Date(assignment.assignedAt).toLocaleDateString("vi-VN")
                : ""}
            </span>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUnassign(employee.id, program.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// Program Item in Employee View
function ProgramItemInEmployee({
  program,
  assignment,
  onUnassign,
  selectedItems,
  onToggleSelect,
  userId,
}: {
  program: Program;
  assignment?: Assignment;
  onUnassign: (userId: string, programId: string) => void;
  selectedItems: Set<string>;
  onToggleSelect: (key: string) => void;
  userId: string;
}) {
  const key = `${userId}_${program.id}`;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox
          checked={selectedItems.has(key)}
          onCheckedChange={() => onToggleSelect(key)}
          className="shrink-0"
        />
        <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/programs/${program.id}`}
            className="font-medium text-sm hover:text-primary truncate block"
          >
            {program.title}
          </Link>
          {program.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">
              {program.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {assignment && (
          <>
            <Badge
              variant={
                assignment.status === "completed"
                  ? "success"
                  : assignment.status === "in_progress"
                  ? "warning"
                  : "secondary"
              }
              className="text-xs hidden sm:inline-flex"
            >
              {assignment.status === "completed"
                ? "Hoàn thành"
                : assignment.status === "in_progress"
                ? "Đang học"
                : "Chưa học"}
            </Badge>
            <span className="text-xs text-muted-foreground hidden md:inline">
              {assignment.assignedAt
                ? new Date(assignment.assignedAt).toLocaleDateString("vi-VN")
                : ""}
            </span>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUnassign(userId, program.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AdminAssignmentsPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const searchParams = useSearchParams();
  const presetProgramId = searchParams.get("programId");

  const [programs, setPrograms] = useState<Program[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("programs");

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Bulk selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Dialog state
  const [openAssign, setOpenAssign] = useState(false);
  const [assignMode, setAssignMode] = useState<"program" | "employee">("program");
  const [selectedProgram, setSelectedProgram] = useState<string>(
    presetProgramId ?? ""
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  // Dialog search
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");

  // Manager assignment dialog state
  const [openManagerDialog, setOpenManagerDialog] = useState(false);
  const [selectedProgramForManager, setSelectedProgramForManager] = useState<Program | null>(null);
  const [selectedManagerIds, setSelectedManagerIds] = useState<Set<string>>(new Set());
  const [managerSearchQuery, setManagerSearchQuery] = useState("");
  const [isAssigningManagers, setIsAssigningManagers] = useState(false);
  const [allManagers, setAllManagers] = useState<User[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progRes, usersSnap, assignsRes] = await Promise.all([
        programService.list(),
        getDocs(collection(db, "users")),
        assignmentService.list(),
      ]);
      if (progRes.success) {
        setPrograms(
          (progRes.data as { items: Program[] }).items.filter(
            (p) => p.status === "published"
          )
        );
      }
      const userList: User[] = usersSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...(data as Omit<User, "id">),
        };
      });
      setAllUsers(userList.filter((u) => u.isActive));
      setAllManagers(userList.filter((u) => u.role === "manager" && u.isActive));
      if (assignsRes.success) {
        setAssignments((assignsRes.data as { items: Assignment[] }).items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [fetchData, isAdmin]);

  useEffect(() => {
    if (presetProgramId) {
      setSelectedProgram(presetProgramId);
      setViewMode("programs");
    }
  }, [presetProgramId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter, viewMode]);

  // Filter users based on role
  const users = useMemo(() => {
    if (user?.role === "manager") {
      return allUsers.filter(
        (u) => u.role === "employee" && u.managerId === user.id
      );
    }
    return allUsers.filter((u) => u.role === "employee");
  }, [allUsers, user]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    users.forEach((u) => {
      if (u.department) depts.add(u.department);
    });
    return Array.from(depts).sort();
  }, [users]);

  // Filter by search and department
  const filteredUsers = useMemo(() => {
    let result = users;
    if (departmentFilter !== "all") {
      result = result.filter((u) => u.department === departmentFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.displayName ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, departmentFilter, searchQuery]);

  const filteredPrograms = useMemo(() => {
    if (!searchQuery) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  // Build assignment maps
  const userAssignmentsMap = useMemo(() => {
    const map = new Map<string, Map<string, Assignment>>();
    for (const a of assignments) {
      if (!map.has(a.userId)) map.set(a.userId, new Map());
      map.get(a.userId)!.set(a.programId, a);
    }
    return map;
  }, [assignments]);

  const programAssignmentsMap = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!map.has(a.programId)) map.set(a.programId, []);
      map.get(a.programId)!.push(a);
    }
    return map;
  }, [assignments]);

  // Stats
  const stats = useMemo(() => {
    let filteredAssigns = assignments;
    if (statusFilter !== "all") {
      filteredAssigns = assignments.filter((a) => a.status === statusFilter);
    }
    const assignedUsers = new Set(filteredAssigns.map((a) => a.userId));
    const completedAssignments = filteredAssigns.filter(
      (a) => a.status === "completed"
    );
    const inProgressAssignments = filteredAssigns.filter(
      (a) => a.status === "in_progress"
    );
    return {
      totalAssignments: filteredAssigns.length,
      assignedUsers: assignedUsers.size,
      completed: completedAssignments.length,
      inProgress: inProgressAssignments.length,
    };
  }, [assignments, statusFilter]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSectionExpanded = useCallback(
    (id: string) => expandedSections.has(id),
    [expandedSections]
  );

  // Toggle selection
  const toggleSelect = useCallback((key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(
    (keys: string[]) => {
      setSelectedItems((prev) => {
        const allSelected = keys.every((k) => prev.has(k));
        const next = new Set(prev);
        if (allSelected) {
          keys.forEach((k) => next.delete(k));
        } else {
          keys.forEach((k) => next.add(k));
        }
        return next;
      });
    },
    []
  );

  // Bulk unassign
  const handleBulkUnassign = async () => {
    if (selectedItems.size === 0) return;
    const count = selectedItems.size;
    if (
      !window.confirm(
        `Hủy gán ${count} phép gán? Tiến độ sẽ bị xóa.`
      )
    )
      return;

    setIsLoading(true);
    setError(null);

    const items = Array.from(selectedItems).map((key) => {
      const [userId, programId] = key.split("_");
      return { userId, programId };
    });

    try {
      const res = await assignmentService.unassignBatch(items);
      if (res.success) {
        const data = res.data as { success: string[]; failed: string[] };
        const successCount = data.success.length;
        const failedCount = data.failed.length;
        setSelectedItems(new Set());
        await fetchData();
        if (failedCount === 0) {
          setSuccess(`Đã hủy gán ${successCount} phép gán`);
        } else {
          setSuccess(`Đã hủy gán ${successCount}, thất bại ${failedCount}`);
        }
      } else {
        setError((res as { error?: string }).error ?? "Lỗi hủy gán");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    setIsAssigning(true);
    setError(null);
    try {
      if (assignMode === "program") {
        // Gán 1 chương trình cho nhiều nhân viên
        if (!selectedProgram) {
          setError("Chọn chương trình trước");
          return;
        }
        if (selectedUserIds.size === 0) {
          setError("Chọn ít nhất 1 nhân viên");
          return;
        }
        const res = await assignmentService.create({
          userIds: Array.from(selectedUserIds),
          programId: selectedProgram,
        });
        if (res.success) {
          const data = res.data as { created: string[]; skipped: string[] };
          setSuccess(
            `Đã gán cho ${data.created.length} nhân viên${
              data.skipped.length > 0
                ? `, ${data.skipped.length} đã được gán trước đó (bỏ qua)`
                : ""
            }`
          );
          setOpenAssign(false);
          setSelectedUserIds(new Set());
          setDialogSearchQuery("");
          await fetchData();
        } else {
          setError((res as { error?: string }).error ?? "Lỗi gán");
        }
      } else {
        // Gán nhiều chương trình cho 1 nhân viên
        if (selectedUserIds.size === 0) {
          setError("Chọn ít nhất 1 nhân viên");
          return;
        }
        if (selectedProgramIds.size === 0) {
          setError("Chọn ít nhất 1 chương trình");
          return;
        }
        // Chỉ lấy user đầu tiên (vì đang ở chế độ gán theo nhân viên)
        const userId = Array.from(selectedUserIds)[0];
        const res = await assignmentService.assignProgramsToUser(
          userId,
          Array.from(selectedProgramIds)
        );
        if (res.success) {
          const data = res.data as { created: string[]; skipped: string[] };
          const createdPrograms = data.created.length;
          const skippedPrograms = data.skipped.length;
          setSuccess(
            `Đã gán ${createdPrograms} chương trình cho nhân viên${
              skippedPrograms > 0 ? `, ${skippedPrograms} đã được gán trước đó (bỏ qua)` : ""
            }`
          );
          setOpenAssign(false);
          setSelectedUserIds(new Set());
          setSelectedProgramIds(new Set());
          setDialogSearchQuery("");
          await fetchData();
        } else {
          setError((res as { error?: string }).error ?? "Lỗi gán");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (userId: string, programId: string) => {
    if (!window.confirm("Hủy gán chương trình này? Tiến độ sẽ bị xóa."))
      return;
    try {
      const res = await assignmentService.unassign(userId, programId);
      if (res.success) {
        setSuccess("Đã hủy gán");
        await fetchData();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi hủy gán");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Manager assignment
  const openManagerDialogHandler = (program: Program) => {
    setSelectedProgramForManager(program);
    setSelectedManagerIds(
      new Set((program as unknown as { assignedManagers?: string[] }).assignedManagers ?? [])
    );
    setManagerSearchQuery("");
    setOpenManagerDialog(true);
  };

  const handleAssignManagers = async () => {
    if (!selectedProgramForManager) return;
    if (user?.role !== "admin") {
      setError("Chỉ admin mới có quyền gán quản lý");
      return;
    }
    setIsAssigningManagers(true);
    setError(null);
    try {
      const res = await apiPut(
        `/api/programs/${selectedProgramForManager.id}/managers`,
        { managerIds: Array.from(selectedManagerIds) }
      );
      if (res.success) {
        setSuccess(`Đã gán ${selectedManagerIds.size} quản lý cho chương trình`);
        setOpenManagerDialog(false);
        await fetchData();
      } else {
        setError(res.error ?? "Lỗi gán quản lý");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAssigningManagers(false);
    }
  };

  const filteredManagers = useMemo(() => {
    if (!managerSearchQuery) return allManagers;
    const q = managerSearchQuery.toLowerCase();
    return allManagers.filter(
      (m) =>
        (m.displayName ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
    );
  }, [allManagers, managerSearchQuery]);

  // Filter dialog users - always use full user list for dialog to avoid being affected by main page filters
  const dialogFilteredUsers = useMemo(() => {
    // Use all filtered users from main page for "program" mode (select employees for a program)
    let usersToFilter = filteredUsers;
    
    // For "employee" mode (assign multiple programs to one employee), show all employees regardless of main page filters
    if (assignMode === "employee") {
      usersToFilter = users; // Use unfiltered users (only role filter)
    }
    
    if (!dialogSearchQuery) return usersToFilter;
    const q = dialogSearchQuery.toLowerCase();
    return usersToFilter.filter(
      (u) =>
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [filteredUsers, users, dialogSearchQuery, assignMode]);

  if (!isAdmin) {
    return (
      <PageContainer title="Gán chương trình">
        <Alert variant="destructive">
          <AlertDescription>
            Chỉ admin hoặc manager mới có quyền truy cập.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gán chương trình đào tạo"
      description="Quản lý việc gán chương trình cho nhân viên"
      showBreadcrumb={false}
      actions={
        <div className="flex gap-2 flex-wrap">
          {selectedItems.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkUnassign}
              disabled={isLoading}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Hủy gán ({selectedItems.size})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Tải lại</span>
          </Button>
          <Button
            onClick={() => {
              setAssignMode("program");
              setOpenAssign(true);
            }}
            disabled={programs.length === 0}
            size="sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Gán chương trình
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <button
              onClick={() => setError(null)}
              className="float-right opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Tổng phép gán
                </p>
                <p className="text-2xl sm:text-3xl font-bold">
                  {stats.totalAssignments}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Đã hoàn thành
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">
                  {stats.completed}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Đang học
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                  {stats.inProgress}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  NV được gán
                </p>
                <p className="text-2xl sm:text-3xl font-bold">
                  {stats.assignedUsers}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning if no programs */}
      {programs.length === 0 && !isLoading && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Chưa có chương trình <strong>published</strong>. Hãy publish ít nhất
            1 chương trình trước khi gán.
            <Link
              href="/admin/programs"
              className="ml-2 font-medium text-primary underline"
            >
              Đi tới quản lý chương trình
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters & View Toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={
              viewMode === "programs"
                ? "Tìm chương trình..."
                : "Tìm nhân viên..."
            }
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          {viewMode === "employees" && departments.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">
                    {departmentFilter === "all" ? "Phòng ban" : departmentFilter}
                  </span>
                  <span className="sm:hidden">Phòng</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Phòng ban</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={departmentFilter === "all"}
                  onCheckedChange={() => setDepartmentFilter("all")}
                >
                  Tất cả
                </DropdownMenuCheckboxItem>
                {departments.map((dept) => (
                  <DropdownMenuCheckboxItem
                    key={dept}
                    checked={departmentFilter === dept}
                    onCheckedChange={() => setDepartmentFilter(dept)}
                  >
                    {dept}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <ListFilter className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">
                  {statusFilter === "all"
                    ? "Trạng thái"
                    : statusFilter === "not_started"
                    ? "Chưa học"
                    : statusFilter === "in_progress"
                    ? "Đang học"
                    : "Hoàn thành"}
                </span>
                <span className="sm:hidden">TT</span>
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Trạng thái</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { value: "all", label: "Tất cả" },
                { value: "not_started", label: "Chưa học" },
                { value: "in_progress", label: "Đang học" },
                { value: "completed", label: "Hoàn thành" },
              ].map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.value}
                  checked={statusFilter === opt.value}
                  onCheckedChange={() =>
                    setStatusFilter(opt.value as StatusFilter)
                  }
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            <Button
              variant={viewMode === "programs" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2 sm:px-3"
              onClick={() => setViewMode("programs")}
            >
              <LayoutGrid className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Theo CT</span>
            </Button>
            <Button
              variant={viewMode === "employees" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-2 sm:px-3"
              onClick={() => setViewMode("employees")}
            >
              <Users className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Theo NV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : viewMode === "programs" ? (
        /* View by Programs */
        filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Không có chương trình nào.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPrograms.map((program) => {
              const programAssigns = programAssignmentsMap.get(program.id) ?? [];
              const filteredAssigns =
                statusFilter === "all"
                  ? programAssigns
                  : programAssigns.filter((a) => a.status === statusFilter);
              const completed = filteredAssigns.filter(
                (a) => a.status === "completed"
              ).length;
              const isExpanded = isSectionExpanded(program.id);

              // Get unique employees who have this program assigned
              const assignedUserIds = new Set(filteredAssigns.map((a) => a.userId));
              const assignedEmployees = filteredUsers.filter((u) =>
                assignedUserIds.has(u.id)
              );

              // Calculate progress percentage
              const progressPercent =
                filteredAssigns.length > 0
                  ? Math.round((completed / filteredAssigns.length) * 100)
                  : 0;

              return (
                <Card key={program.id} className="overflow-hidden">
                  <div
                    onClick={() => toggleSection(program.id)}
                    className="cursor-pointer"
                  >
                    <CardHeader className="pb-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 text-primary shrink-0">
                            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                              <span className="truncate">{program.title}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {filteredAssigns.length} NV
                              </Badge>
                              {((program as unknown as { assignedManagers?: string[] }).assignedManagers?.length ?? 0) > 0 && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  <UserCog className="mr-1 h-3 w-3" />
                                  {(program as unknown as { assignedManagers?: string[] }).assignedManagers?.length} QLý
                                </Badge>
                              )}
                            </CardTitle>
                            {program.description && (
                              <CardDescription className="text-xs mt-0.5 line-clamp-1 hidden sm:block">
                                {program.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          {filteredAssigns.length > 0 && (
                            <div className="hidden sm:flex items-center gap-2 mr-2">
                              <span className="text-sm text-green-600 font-medium">
                                {completed} hoàn thành
                              </span>
                              <div className="w-16 sm:w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {progressPercent}%
                              </span>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs sm:text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProgram(program.id);
                              setOpenAssign(true);
                            }}
                          >
                            <UserPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Gán thêm</span>
                            <span className="sm:hidden">Gán</span>
                          </Button>
                          {user?.role === "admin" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs sm:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openManagerDialogHandler(program);
                              }}
                            >
                              <UserCog className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Gán QLý</span>
                              <span className="sm:hidden">QL</span>
                            </Button>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </div>
                  {isExpanded && (
                    <CardContent className="pt-0 border-t">
                      {/* Select all header */}
                      {assignedEmployees.length > 1 && (
                        <div className="flex items-center gap-2 pb-3 mb-2 border-b">
                          <Checkbox
                            checked={filteredAssigns.every((a) =>
                              selectedItems.has(`${a.userId}_${program.id}`)
                            )}
                            onCheckedChange={() =>
                              toggleSelectAll(
                                assignedEmployees.map((e) => `${e.id}_${program.id}`)
                              )
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            Chọn tất cả ({assignedEmployees.length})
                          </span>
                        </div>
                      )}
                      {assignedEmployees.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <UsersRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">
                            {statusFilter !== "all"
                              ? `Không có nhân viên nào ở trạng thái "${statusFilter === "not_started" ? "Chưa học" : statusFilter === "in_progress" ? "Đang học" : "Hoàn thành"}"`
                              : "Chưa có nhân viên nào được gán"}
                          </p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                              setSelectedProgram(program.id);
                              setAssignMode("program");
                              setOpenAssign(true);
                            }}
                          >
                            Gán ngay
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {assignedEmployees.map((employee) => (
                            <EmployeeItem
                              key={employee.id}
                              employee={employee}
                              programAssigns={filteredAssigns}
                              program={program}
                              onUnassign={handleUnassign}
                              selectedItems={selectedItems}
                              onToggleSelect={toggleSelect}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : /* View by Employees */
      filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>
              {user?.role === "manager"
                ? "Bạn chưa có nhân viên nào được gán cho."
                : "Không có nhân viên nào."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filteredUsers
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((employee) => {
            const userAssigns = userAssignmentsMap.get(employee.id) ?? new Map();
            let assignedPrograms = programs.filter((p) => userAssigns.has(p.id));
            
            // Filter by status
            if (statusFilter !== "all") {
              assignedPrograms = assignedPrograms.filter(
                (p) => userAssigns.get(p.id)?.status === statusFilter
              );
            }
            
            const completed = assignedPrograms.filter(
              (p) => userAssigns.get(p.id)?.status === "completed"
            ).length;
            const inProgress = assignedPrograms.filter(
              (p) => userAssigns.get(p.id)?.status === "in_progress"
            ).length;
            const isExpanded = isSectionExpanded(employee.id);

            // Calculate progress percentage
            const progressPercent =
              assignedPrograms.length > 0
                ? Math.round((completed / assignedPrograms.length) * 100)
                : 0;

            return (
              <Card key={employee.id} className="overflow-hidden">
                <div
                  onClick={() => toggleSection(employee.id)}
                  className="cursor-pointer"
                >
                  <CardHeader className="pb-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                          <AvatarImage src={employee.photoURL} />
                          <AvatarFallback className="text-xs sm:text-sm">
                            {getInitials(employee.displayName ?? "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                            <span className="truncate">
                              {employee.displayName}
                            </span>
                            {employee.department && (
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0 hidden sm:inline-flex"
                              >
                                {employee.department}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs shrink-0">
                              {assignedPrograms.length} CT
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5 hidden sm:block">
                            {employee.email}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {assignedPrograms.length > 0 && (
                          <div className="hidden sm:flex items-center gap-2 mr-2">
                            {completed > 0 && (
                              <span className="text-sm text-green-600 font-medium">
                                {completed} hoàn thành
                              </span>
                            )}
                            {inProgress > 0 && (
                              <span className="text-sm text-amber-600 font-medium">
                                {inProgress} đang học
                              </span>
                            )}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignMode("employee");
                            setSelectedUserIds(new Set([employee.id]));
                            setOpenAssign(true);
                          }}
                        >
                          <UserPlus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Gán thêm</span>
                          <span className="sm:hidden">Gán</span>
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </div>
                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    {/* Select all header */}
                    {assignedPrograms.length > 1 && (
                      <div className="flex items-center gap-2 pb-3 mb-2 border-b">
                        <Checkbox
                          checked={assignedPrograms.every((p) =>
                            selectedItems.has(`${employee.id}_${p.id}`)
                          )}
                          onCheckedChange={() =>
                            toggleSelectAll(
                              assignedPrograms.map((p) => `${employee.id}_${p.id}`)
                            )
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          Chọn tất cả ({assignedPrograms.length})
                        </span>
                      </div>
                    )}
                    {assignedPrograms.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {statusFilter !== "all"
                            ? `Không có chương trình ở trạng thái "${statusFilter === "not_started" ? "Chưa học" : statusFilter === "in_progress" ? "Đang học" : "Hoàn thành"}"`
                            : "Chưa có chương trình nào được gán"}
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSelectedUserIds(new Set([employee.id]));
                            setOpenAssign(true);
                          }}
                        >
                          Gán ngay
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignedPrograms.map((program) => {
                          const assignment = userAssigns.get(program.id);
                          return (
                            <ProgramItemInEmployee
                              key={program.id}
                              program={program}
                              assignment={assignment}
                              onUnassign={handleUnassign}
                              selectedItems={selectedItems}
                              onToggleSelect={toggleSelect}
                              userId={employee.id}
                            />
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
          </div>

          {/* Pagination */}
          {filteredUsers.length > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Hiển thị {(currentPage - 1) * pageSize + 1} -{" "}
                {Math.min(currentPage * pageSize, filteredUsers.length)} của{" "}
                {filteredUsers.length} nhân viên
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Trước
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(filteredUsers.length / pageSize) }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === Math.ceil(filteredUsers.length / pageSize) ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .map((page, idx, arr) => (
                      <>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span key={`ellipsis-${page}`} className="px-2 text-muted-foreground">
                            ...
                          </span>
                        )}
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(Math.ceil(filteredUsers.length / pageSize), p + 1)
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(filteredUsers.length / pageSize)
                  }
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog Gán chương trình - Dual Mode */}
      <Dialog
        open={openAssign}
        onOpenChange={(o) => {
          if (!o) {
            setOpenAssign(false);
            setDialogSearchQuery("");
            setSelectedProgram("");
            setSelectedUserIds(new Set());
            setSelectedProgramIds(new Set());
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5" />
              Gán chương trình đào tạo
            </DialogTitle>
            <DialogDescription>
              Chọn chế độ gán phù hợp với nhu cầu của bạn.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 pb-2 border-b shrink-0">
            <Button
              variant={assignMode === "program" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAssignMode("program");
                setSelectedProgramIds(new Set());
                setSelectedUserIds(new Set());
              }}
              className="flex-1"
            >
              <BookOpen className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">1 CT → nhiều NV</span>
              <span className="sm:hidden">1→nhiều</span>
            </Button>
            <Button
              variant={assignMode === "employee" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAssignMode("employee");
                setSelectedProgram("");
                setSelectedProgramIds(new Set());
              }}
              className="flex-1"
            >
              <Users className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Nhiều CT → 1 NV</span>
              <span className="sm:hidden">nhiều→1</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0 py-4">
            {assignMode === "program" ? (
              /* Mode: Gán 1 chương trình cho nhiều nhân viên */
              <>
                {/* Chọn chương trình */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Chương trình đào tạo <span className="text-destructive">*</span>
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2">
                    {programs.map((p) => {
                      const currentAssignCount = assignments.filter(
                        (a) => a.programId === p.id
                      ).length;
                      return (
                        <label
                          key={p.id}
                          className={`
                            flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all
                            ${selectedProgram === p.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                            }
                          `}
                        >
                          <div
                            className={`
                              h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                              ${selectedProgram === p.id
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                              }
                            `}
                          >
                            {selectedProgram === p.id && (
                              <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setSelectedProgram(p.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm truncate">{p.title}</p>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {currentAssignCount} NV
                              </Badge>
                            </div>
                            {p.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Chọn nhân viên */}
                <div>
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Nhân viên
                      <Badge variant="outline" className="text-xs">
                        {selectedUserIds.size} đã chọn
                      </Badge>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => setSelectedUserIds(new Set())}
                      >
                        Bỏ chọn
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() =>
                          setSelectedUserIds(
                            new Set(
                              dialogFilteredUsers
                                .filter((u) => {
                                  if (!selectedProgram) return true;
                                  const userAssigns =
                                    userAssignmentsMap.get(u.id) ?? new Map();
                                  return !userAssigns.has(selectedProgram);
                                })
                                .map((u) => u.id)
                            )
                          )
                        }
                      >
                        Chọn tất cả
                      </Button>
                    </div>
                  </div>

                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Tìm nhân viên..."
                      className="pl-9 h-9"
                      value={dialogSearchQuery}
                      onChange={(e) => setDialogSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {dialogFilteredUsers.map((u) => {
                      const userAssigns =
                        userAssignmentsMap.get(u.id) ?? new Map();
                      const alreadyAssigned =
                        selectedProgram && userAssigns.has(selectedProgram);
                      const assignment = alreadyAssigned
                        ? userAssigns.get(selectedProgram)
                        : null;

                      return (
                        <label
                          key={u.id}
                          className={`
                            flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors
                            ${alreadyAssigned
                              ? "opacity-50 bg-muted/30"
                              : "hover:bg-muted/50"
                            }
                          `}
                        >
                          <Checkbox
                            checked={selectedUserIds.has(u.id)}
                            disabled={Boolean(alreadyAssigned)}
                            onCheckedChange={(checked) => {
                              setSelectedUserIds((s) => {
                                const ns = new Set(s);
                                if (checked) ns.add(u.id);
                                else ns.delete(u.id);
                                return ns;
                              });
                            }}
                            className="shrink-0"
                          />
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={u.photoURL} />
                            <AvatarFallback className="text-xs">
                              {getInitials(u.displayName ?? "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {u.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </p>
                          </div>
                          {alreadyAssigned && assignment && (
                            <div className="shrink-0 text-right">
                              <Badge
                                variant={
                                  assignment.status === "completed"
                                    ? "success"
                                    : assignment.status === "in_progress"
                                    ? "warning"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {assignment.status === "completed"
                                  ? "Hoàn thành"
                                  : assignment.status === "in_progress"
                                  ? "Đang học"
                                  : "Chưa học"}
                              </Badge>
                            </div>
                          )}
                        </label>
                      );
                    })}
                    {dialogFilteredUsers.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        {dialogSearchQuery
                          ? "Không tìm thấy nhân viên"
                          : "Không có nhân viên nào"}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Mode: Gán nhiều chương trình cho 1 nhân viên */
              <>
                {/* Chọn nhân viên */}
                <div>
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Nhân viên <span className="text-destructive">*</span>
                      <Badge variant="outline" className="text-xs">
                        {selectedUserIds.size} đã chọn
                      </Badge>
                    </label>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setSelectedUserIds(new Set())}
                    >
                      Bỏ chọn
                    </Button>
                  </div>

                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Tìm nhân viên..."
                      className="pl-9 h-9"
                      value={dialogSearchQuery}
                      onChange={(e) => setDialogSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                    {dialogFilteredUsers.map((u) => {
                      const userAssigns =
                        userAssignmentsMap.get(u.id) ?? new Map();
                      const assignedCount = userAssigns.size;

                      return (
                        <div
                          key={u.id}
                          className={`
                            flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors
                            ${selectedUserIds.has(u.id)
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50 border border-transparent"
                            }
                          `}
                          onClick={() => {
                            setSelectedUserIds((s) => {
                              const ns = new Set(s);
                              if (ns.has(u.id)) ns.delete(u.id);
                              else ns.add(u.id);
                              return ns;
                            });
                          }}
                        >
                          <div
                            className={`
                              h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                              ${selectedUserIds.has(u.id)
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                              }
                            `}
                          >
                            {selectedUserIds.has(u.id) && (
                              <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={u.photoURL} />
                          <AvatarFallback className="text-xs">
                            {getInitials(u.displayName ?? "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        {assignedCount > 0 && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {assignedCount} CT
                          </Badge>
                        )}
                        </div>
                      );
                    })}
                    {dialogFilteredUsers.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        {dialogSearchQuery
                          ? "Không tìm thấy nhân viên"
                          : "Không có nhân viên nào"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chọn chương trình */}
                <div>
                  <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Chương trình đào tạo <span className="text-destructive">*</span>
                      <Badge variant="outline" className="text-xs">
                        {selectedProgramIds.size} đã chọn
                      </Badge>
                    </label>
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
                        onClick={() => {
                          const userId = Array.from(selectedUserIds)[0];
                          if (!userId) {
                            setSelectedProgramIds(new Set(programs.map((p) => p.id)));
                            return;
                          }
                          const userAssigns = userAssignmentsMap.get(userId) ?? new Map();
                          setSelectedProgramIds(
                            new Set(
                              programs
                                .filter((p) => !userAssigns.has(p.id))
                                .map((p) => p.id)
                            )
                          );
                        }}
                      >
                        Chọn tất cả
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                    {programs.map((p) => {
                      const userId = Array.from(selectedUserIds)[0];
                      const userAssigns = userId
                        ? userAssignmentsMap.get(userId) ?? new Map()
                        : new Map();
                      const alreadyAssigned = userAssigns.has(p.id);
                      const assignment = alreadyAssigned
                        ? userAssigns.get(p.id)
                        : null;

                      return (
                        <label
                          key={p.id}
                          className={`
                            flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors
                            ${alreadyAssigned
                              ? "opacity-50 bg-muted/30"
                              : selectedProgramIds.has(p.id)
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                            }
                          `}
                        >
                          <Checkbox
                            checked={selectedProgramIds.has(p.id)}
                            disabled={Boolean(alreadyAssigned)}
                            onCheckedChange={(checked) => {
                              setSelectedProgramIds((s) => {
                                const ns = new Set(s);
                                if (checked) ns.add(p.id);
                                else ns.delete(p.id);
                                return ns;
                              });
                            }}
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            {p.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {p.description}
                              </p>
                            )}
                          </div>
                          {alreadyAssigned && assignment && (
                            <Badge
                              variant={
                                assignment.status === "completed"
                                  ? "success"
                                  : assignment.status === "in_progress"
                                  ? "warning"
                                  : "secondary"
                              }
                              className="text-xs shrink-0"
                            >
                              {assignment.status === "completed"
                                ? "Hoàn thành"
                                : assignment.status === "in_progress"
                                ? "Đang học"
                                : "Chưa học"}
                            </Badge>
                          )}
                          {!alreadyAssigned && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Chưa gán
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                    {programs.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Không có chương trình nào
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpenAssign(false);
                setDialogSearchQuery("");
              }}
              disabled={isAssigning}
            >
              Hủy
            </Button>
            <Button
              onClick={handleAssign}
              disabled={
                isAssigning ||
                (assignMode === "program"
                  ? !selectedProgram || selectedUserIds.size === 0
                  : selectedUserIds.size === 0 || selectedProgramIds.size === 0)
              }
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang gán...
                </>
              ) : assignMode === "program" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Gán cho {selectedUserIds.size} nhân viên
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Gán {selectedProgramIds.size} chương trình
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gán quản lý */}
      <Dialog
        open={openManagerDialog}
        onOpenChange={(o) => {
          if (!o) {
            setOpenManagerDialog(false);
            setManagerSearchQuery("");
            setSelectedManagerIds(new Set());
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Gán quản lý cho chương trình
            </DialogTitle>
            <DialogDescription>
              Chọn các quản lý được phép quản lý chương trình{" "}
              <strong>&ldquo;{selectedProgramForManager?.title}&rdquo;</strong>.
              Quản lý được chọn có thể chỉnh sửa, gán nhân viên và xem báo cáo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm quản lý..."
                className="pl-9"
                value={managerSearchQuery}
                onChange={(e) => setManagerSearchQuery(e.target.value)}
              />
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {filteredManagers.map((manager) => (
                <label
                  key={manager.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedManagerIds.has(manager.id)}
                    onCheckedChange={(checked) => {
                      setSelectedManagerIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(manager.id);
                        else next.delete(manager.id);
                        return next;
                      });
                    }}
                  />
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={manager.photoURL} />
                    <AvatarFallback className="text-xs">
                      {getInitials(manager.displayName ?? "M")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {manager.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {manager.email}
                    </p>
                  </div>
                </label>
              ))}
              {filteredManagers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {managerSearchQuery
                    ? "Không tìm thấy quản lý"
                    : "Chưa có quản lý nào trong hệ thống"}
                </p>
              )}
            </div>

            {selectedManagerIds.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                Đã chọn {selectedManagerIds.size} quản lý
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenManagerDialog(false)}
              disabled={isAssigningManagers}
            >
              Hủy
            </Button>
            <Button
              onClick={handleAssignManagers}
              disabled={isAssigningManagers}
            >
              {isAssigningManagers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Lưu ({selectedManagerIds.size} quản lý)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
