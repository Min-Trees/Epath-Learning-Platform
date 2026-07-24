"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assignmentService, programService } from "@/services/training";
import { getInitials } from "@/utils";
import type { Program, Assignment } from "@/types/training";
import type { User } from "@/types";

type ViewMode = "programs" | "employees";

export default function AdminAssignmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải...</div>}>
      <AdminAssignmentsPageInner />
    </Suspense>
  );
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  badge,
  progress,
  children,
  defaultOpen = true,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: { label: string; variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" };
  progress?: { completed: number; total: number };
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {title}
                  {badge && (
                    <Badge variant={badge.variant ?? "outline"} className="text-xs">
                      {badge.label}
                    </Badge>
                  )}
                </CardTitle>
                {subtitle && (
                  <CardDescription className="text-xs mt-0.5">
                    {subtitle}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {progress && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-green-600 font-medium">
                    {progress.completed} hoàn thành
                  </span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: progress.total > 0
                          ? `${(progress.completed / progress.total) * 100}%`
                          : "0%"
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progress.total}
                  </span>
                </div>
              )}
              {actions && <div className="mr-2" onClick={(e) => e.stopPropagation()}>{actions}</div>}
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
      </button>
      {isOpen && (
        <CardContent className="pt-0 border-t">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// Employee Item in Program View
function EmployeeItem({
  employee,
  assignments,
  programs,
  onUnassign,
  allUsers,
}: {
  employee: User;
  assignments: Assignment[];
  programs: Program[];
  onUnassign: (userId: string, programId: string) => void;
  allUsers: User[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const employeeAssignments = assignments.filter((a) => a.userId === employee.id);
  const completed = employeeAssignments.filter((a) => a.status === "completed").length;
  const inProgress = employeeAssignments.filter((a) => a.status === "in_progress").length;

  if (employeeAssignments.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={employee.photoURL} />
            <AvatarFallback className="text-sm">
              {getInitials(employee.displayName ?? "U")}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="font-medium text-sm">{employee.displayName}</p>
            <p className="text-xs text-muted-foreground">{employee.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {completed > 0 && (
              <Badge variant="success" className="text-xs">
                {completed} hoàn thành
              </Badge>
            )}
            {inProgress > 0 && (
              <Badge variant="warning" className="text-xs">
                {inProgress} đang học
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="px-3 pb-3 border-t bg-muted/20">
          <div className="pt-3 space-y-2">
            {employeeAssignments.map((a) => {
              const program = programs.find((p) => p.id === a.programId);
              if (!program) return null;
              return (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-background">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/admin/programs/${program.id}`}
                      className="text-sm hover:text-primary"
                    >
                      {program.title}
                    </Link>
                    <Badge
                      variant={
                        a.status === "completed"
                          ? "success"
                          : a.status === "in_progress"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {a.status === "completed"
                        ? "Hoàn thành"
                        : a.status === "in_progress"
                        ? "Đang học"
                        : "Chưa học"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onUnassign(employee.id, program.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Program Item in Employee View
function ProgramItem({
  program,
  assignment,
  onUnassign,
}: {
  program: Program;
  assignment?: Assignment;
  onUnassign: (userId: string, programId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <div>
          <Link
            href={`/admin/programs/${program.id}`}
            className="font-medium text-sm hover:text-primary"
          >
            {program.title}
          </Link>
          {program.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {program.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant={
            assignment?.status === "completed"
              ? "success"
              : assignment?.status === "in_progress"
              ? "warning"
              : "secondary"
          }
        >
          {assignment?.status === "completed"
            ? "Hoàn thành"
            : assignment?.status === "in_progress"
            ? "Đang học"
            : "Chưa học"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onUnassign(program.id, program.id)}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AdminAssignmentsPageInner() {
  const { user } = useAuth();
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

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [openAssign, setOpenAssign] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>(
    presetProgramId ?? ""
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set()
  );
  const [isAssigning, setIsAssigning] = useState(false);

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

  // Filter users based on role
  const users = useMemo(() => {
    if (user?.role === "manager") {
      return allUsers.filter(
        (u) => u.role === "employee" && u.managerId === user.id
      );
    }
    return allUsers.filter((u) => u.role === "employee");
  }, [allUsers, user]);

  // Filter by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

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
    const assignedUsers = new Set(assignments.map((a) => a.userId));
    const completedAssignments = assignments.filter(
      (a) => a.status === "completed"
    );
    const inProgressAssignments = assignments.filter(
      (a) => a.status === "in_progress"
    );
    return {
      totalAssignments: assignments.length,
      assignedUsers: assignedUsers.size,
      completed: completedAssignments.length,
      inProgress: inProgressAssignments.length,
    };
  }, [assignments]);

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

  const isSectionExpanded = useCallback((id: string) => {
    return expandedSections.has(id);
  }, [expandedSections]);

  const handleAssign = async () => {
    if (!selectedProgram) {
      setError("Chọn chương trình trước");
      return;
    }
    if (selectedUserIds.size === 0) {
      setError("Chọn ít nhất 1 nhân viên");
      return;
    }
    setIsAssigning(true);
    setError(null);
    try {
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
        await fetchData();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi gán");
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

  if (!isAdmin) {
    return (
      <PageContainer title="Gán chương trình">
        <Alert variant="destructive">
          <AlertDescription>Chỉ admin hoặc manager mới có quyền truy cập.</AlertDescription>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>
          <Button onClick={() => setOpenAssign(true)} disabled={programs.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Gán chương trình
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
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tổng phép gán
                </p>
                <p className="text-3xl font-bold">{stats.totalAssignments}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Đã hoàn thành
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.completed}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Đang học
                </p>
                <p className="text-3xl font-bold text-amber-600">
                  {stats.inProgress}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nhân viên được gán
                </p>
                <p className="text-3xl font-bold">{stats.assignedUsers}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
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
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
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

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === "programs" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("programs")}
            >
              <BookOpen className="mr-1 h-4 w-4" />
              Theo chương trình
            </Button>
            <Button
              variant={viewMode === "employees" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("employees")}
            >
              <Users className="mr-1 h-4 w-4" />
              Theo nhân viên
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
              const completed = programAssigns.filter((a) => a.status === "completed").length;
              const isExpanded = isSectionExpanded(program.id);

              // Get unique employees who have this program assigned
              const assignedUserIds = new Set(programAssigns.map((a) => a.userId));
              const assignedEmployees = users.filter((u) => assignedUserIds.has(u.id));

              return (
                <Card key={program.id} className="overflow-hidden">
                  <div
                    onClick={() => toggleSection(program.id)}
                    className="cursor-pointer"
                  >
                    <CardHeader className="pb-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                              <span className="truncate">{program.title}</span>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {programAssigns.length} nhân viên
                              </Badge>
                            </CardTitle>
                            {program.description && (
                              <CardDescription className="text-xs mt-0.5 line-clamp-1">
                                {program.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {programAssigns.length > 0 && (
                            <div className="flex items-center gap-2 mr-2">
                              <span className="text-sm text-green-600 font-medium">
                                {completed} hoàn thành
                              </span>
                              <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{
                                    width: programAssigns.length > 0
                                      ? `${(completed / programAssigns.length) * 100}%`
                                      : "0%"
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProgram(program.id);
                              setOpenAssign(true);
                            }}
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Gán thêm
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
                      {assignedEmployees.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <UsersRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Chưa có nhân viên nào được gán</p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                              setSelectedProgram(program.id);
                              setOpenAssign(true);
                            }}
                          >
                            Gán ngay
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-3">
                          {assignedEmployees.map((employee) => (
                            <EmployeeItem
                              key={employee.id}
                              employee={employee}
                              assignments={programAssigns}
                              programs={[program]}
                              onUnassign={handleUnassign}
                              allUsers={allUsers}
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
        <div className="space-y-3">
          {filteredUsers.map((employee) => {
            const userAssigns = userAssignmentsMap.get(employee.id) ?? new Map();
            const assignedPrograms = programs.filter((p) => userAssigns.has(p.id));
            const completed = assignedPrograms.filter(
              (p) => userAssigns.get(p.id)?.status === "completed"
            ).length;
            const inProgress = assignedPrograms.filter(
              (p) => userAssigns.get(p.id)?.status === "in_progress"
            ).length;
            const isExpanded = isSectionExpanded(employee.id);

            return (
              <Card key={employee.id} className="overflow-hidden">
                <div
                  onClick={() => toggleSection(employee.id)}
                  className="cursor-pointer"
                >
                  <CardHeader className="pb-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={employee.photoURL} />
                          <AvatarFallback className="text-sm">
                            {getInitials(employee.displayName ?? "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                            <span className="truncate">{employee.displayName}</span>
                            {employee.department && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {employee.department}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs shrink-0">
                              {assignedPrograms.length} chương trình
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {employee.email}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {assignedPrograms.length > 0 && (
                          <div className="flex items-center gap-2 mr-2">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserIds(new Set([employee.id]));
                            setOpenAssign(true);
                          }}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Gán thêm
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
                    {assignedPrograms.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Chưa có chương trình nào được gán</p>
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
                      <div className="space-y-2 pt-3">
                        {assignedPrograms.map((program) => {
                          const assignment = userAssigns.get(program.id);
                          return (
                            <div
                              key={program.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <Link
                                    href={`/admin/programs/${program.id}`}
                                    className="font-medium text-sm hover:text-primary truncate block"
                                  >
                                    {program.title}
                                  </Link>
                                  {program.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {program.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <Badge
                                  variant={
                                    assignment?.status === "completed"
                                      ? "success"
                                      : assignment?.status === "in_progress"
                                      ? "warning"
                                      : "secondary"
                                  }
                                >
                                  {assignment?.status === "completed"
                                    ? "Hoàn thành"
                                    : assignment?.status === "in_progress"
                                    ? "Đang học"
                                    : "Chưa học"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUnassign(employee.id, program.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
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
      )}

      {/* Dialog Gán chương trình */}
      <Dialog open={openAssign} onOpenChange={(o) => !o && setOpenAssign(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Gán chương trình đào tạo
            </DialogTitle>
            <DialogDescription>
              Chọn chương trình và nhân viên muốn gán.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Chọn chương trình */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Chương trình đào tạo <span className="text-destructive">*</span>
              </label>
              <div className="space-y-2">
                {programs.map((p) => (
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
                    <div className="flex-1 min-w-0" onClick={() => setSelectedProgram(p.id)}>
                      <p className="font-medium">{p.title}</p>
                      {p.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Chọn nhân viên */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">
                  Nhân viên ({selectedUserIds.size} đã chọn)
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
                      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)))
                    }
                  >
                    Chọn tất cả
                  </Button>
                </div>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
                {filteredUsers.map((u) => {
                  const userAssigns = userAssignmentsMap.get(u.id) ?? new Map();
                  const alreadyAssigned = selectedProgram && userAssigns.has(selectedProgram);
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
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={u.photoURL} />
                        <AvatarFallback className="text-xs">
                          {getInitials(u.displayName ?? "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>
                      {alreadyAssigned && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Đã gán
                        </Badge>
                      )}
                    </label>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Không có nhân viên nào
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAssign(false)} disabled={isAssigning}>
              Hủy
            </Button>
            <Button onClick={handleAssign} disabled={isAssigning || !selectedProgram || selectedUserIds.size === 0}>
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang gán...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Gán cho {selectedUserIds.size} nhân viên
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
