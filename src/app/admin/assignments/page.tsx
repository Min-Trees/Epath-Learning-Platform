"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  Users,
  ChevronRight,
  RefreshCw,
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
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  collection,
  getDocs,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assignmentService, programService } from "@/services/training";
import { getInitials } from "@/utils";
import type { Program, Assignment } from "@/types/training";
import type { User } from "@/types";

export default function AdminAssignmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải...</div>}>
      <AdminAssignmentsPageInner />
    </Suspense>
  );
}

function AdminAssignmentsPageInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const searchParams = useSearchParams();
  const presetProgramId = searchParams.get("programId");

  const [programs, setPrograms] = useState<Program[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      setUsers(userList.filter((u) => u.isActive));
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
    if (presetProgramId) setSelectedProgram(presetProgramId);
  }, [presetProgramId]);

  const filteredUsers = users.filter((u) => {
    if (u.role !== "employee") return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    );
  });

  // Build matrix: user -> program -> assignment
  const matrix = new Map<string, Map<string, Assignment>>();
  for (const a of assignments) {
    if (!matrix.has(a.userId)) matrix.set(a.userId, new Map());
    matrix.get(a.userId)!.set(a.programId, a);
  }

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
    if (!window.confirm("Hủy gán chương trình này? Tiến độ sẽ bị xóa.")) return;
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
          <AlertDescription>Chỉ admin mới có quyền truy cập.</AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gán chương trình"
      description="Chọn chương trình đã publish và nhân viên để gán"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Gán chương trình" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>
          <Button
            onClick={() => setOpenAssign(true)}
            disabled={programs.length === 0}
          >
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

      {programs.length === 0 && !isLoading && (
        <Alert className="mb-4">
          <AlertDescription>
            Chưa có chương trình <strong>published</strong>. Hãy publish ít nhất
            1 chương trình trước khi gán.
            <Link
              href="/admin/programs"
              className="ml-2 font-medium text-primary underline"
            >
              Đi tới quản lý chương trình →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm nhân viên..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredUsers.length} nhân viên · {programs.length} chương trình đã
          publish
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Không có nhân viên nào đang hoạt động.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nhân viên</th>
                {programs.map((p) => (
                  <th
                    key={p.id}
                    className="px-3 py-2 text-left font-medium"
                    style={{ minWidth: 140 }}
                  >
                    <Link
                      href={`/admin/programs/${p.id}`}
                      className="hover:underline"
                    >
                      {p.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const userMatrix = matrix.get(u.id) ?? new Map();
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.photoURL} alt={u.displayName} />
                          <AvatarFallback className="text-xs">
                            {getInitials(u.displayName ?? u.email ?? "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{u.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    {programs.map((p) => {
                      const a = userMatrix.get(p.id);
                      return (
                        <td key={p.id} className="px-3 py-2">
                          {a ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  a.status === "completed"
                                    ? "success"
                                    : a.status === "in_progress"
                                      ? "warning"
                                      : "secondary"
                                }
                              >
                                {a.status === "completed"
                                  ? "Hoàn thành"
                                  : a.status === "in_progress"
                                    ? "Đang học"
                                    : "Chưa bắt đầu"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleUnassign(u.id, p.id)}
                                title="Hủy gán"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                setSelectedProgram(p.id);
                                setSelectedUserIds(new Set([u.id]));
                                const res = await assignmentService.create({
                                  userIds: [u.id],
                                  programId: p.id,
                                });
                                if (res.success) {
                                  setSuccess(`Đã gán cho ${u.displayName}`);
                                  await fetchData();
                                }
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Gán
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={openAssign} onOpenChange={(o) => !o && setOpenAssign(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gán chương trình</DialogTitle>
            <DialogDescription>
              Chọn chương trình và nhân viên muốn gán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Chương trình
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
              >
                <option value="">-- chọn --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">
                  Nhân viên ({selectedUserIds.size} đã chọn)
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSelectedUserIds(new Set())}
                  >
                    Bỏ chọn
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
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
                  const userMatrix = matrix.get(u.id) ?? new Map();
                  const alreadyAssigned =
                    selectedProgram && userMatrix.has(selectedProgram);
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
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
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.photoURL} />
                        <AvatarFallback className="text-xs">
                          {getInitials(u.displayName ?? u.email ?? "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-sm">
                        {u.displayName}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {u.email}
                        </span>
                      </div>
                      {alreadyAssigned && (
                        <Badge variant="secondary" className="text-xs">
                          Đã gán
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpenAssign(false)}
                disabled={isAssigning}
              >
                Hủy
              </Button>
              <Button onClick={handleAssign} disabled={isAssigning}>
                {isAssigning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Gán
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
