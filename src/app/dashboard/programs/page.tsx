"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Play,
  ChevronRight,
  ChevronDown,
  Layers,
  Plus,
  X,
  Edit,
  Check,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks";
import { myProgramsService, groupService, programService } from "@/services/training";
import type { ProgramGroup } from "@/types/training";

type ProgramItem = {
  assignmentId: string;
  userId: string;
  programId: string;
  status: string;
  program: {
    id: string;
    title: string;
    description: string;
    status: string;
    groupId?: string | null;
  } | null;
  progress?: { totalLessons: number; completedLessons: number; percent: number };
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" }> = {
  not_started: { label: "Chưa bắt đầu", variant: "secondary" },
  in_progress: { label: "Đang học", variant: "warning" },
  completed: { label: "Hoàn thành", variant: "success" },
};

export default function EmployeeProgramsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const queryClient = useQueryClient();

  const {
    data: rawData,
    isLoading,
    error: rqError,
  } = useQuery({
    queryKey: ["me", "programs"],
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const res = await myProgramsService.list();
      if (!res.success) {
        throw new Error((res as { error?: string }).error ?? "Lỗi tải");
      }
      return res.data as { items: ProgramItem[]; groups?: ProgramGroup[] };
    },
  });

  const error = rqError ? (rqError instanceof Error ? rqError.message : String(rqError)) : null;
  const items = rawData?.items ?? [];
  const groups = rawData?.groups ?? [];

  // Separate in-progress / completed
  const { inProgress, completed } = useMemo(() => {
    const a = items.filter((i) => i.program !== null);
    return {
      inProgress: a.filter((i) => i.status === "in_progress" || i.status === "not_started"),
      completed: a.filter((i) => i.status === "completed"),
    };
  }, [items]);

  return (
    <PageContainer
      title="Chương trình của tôi"
      description={`Xin chào ${user?.displayName ?? "bạn"}!`}
      breadcrumbs={[{ label: "Chương trình của tôi" }]}
      actions={
        isAdmin ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/programs">
              <Layers className="mr-2 h-4 w-4" />
              Quản lý chương trình
            </Link>
          </Button>
        ) : null
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">Chưa có chương trình nào</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin sẽ gán chương trình cho bạn sớm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <ProgramsByGroup
              label="Đang học"
              items={inProgress}
              groups={groups}
              isAdmin={isAdmin}
            />
          )}
          {completed.length > 0 && (
            <ProgramsByGroup
              label="Đã hoàn thành"
              items={completed}
              groups={groups}
              isAdmin={isAdmin}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}

function ProgramsByGroup({
  label,
  items,
  groups,
  isAdmin,
}: {
  label: string;
  items: ProgramItem[];
  groups: ProgramGroup[];
  isAdmin: boolean;
}) {
  // Group items by groupId
  const { byGroup, ungrouped } = useMemo(() => {
    const byGroup = new Map<string | null, ProgramItem[]>();
    byGroup.set(null, []);
    for (const g of groups) byGroup.set(g.id, []);
    for (const item of items) {
      const gId = item.program?.groupId ?? null;
      if (!byGroup.has(gId)) byGroup.set(gId, []);
      byGroup.get(gId)!.push(item);
    }
    const ungrouped = byGroup.get(null) ?? [];
    byGroup.delete(null);
    return { byGroup, ungrouped };
  }, [items, groups]);

  // Sort groups by order
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [groups]);

  // Check if there are any grouped items (non-null groups)
  const hasGroupedItems = Array.from(byGroup.values()).some(arr => arr.length > 0);
  const hasUngroupedItems = ungrouped.length > 0;

  // Don't show empty groups section if no items
  if (!hasGroupedItems && !hasUngroupedItems) return null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
        {label} ({items.length})
      </h2>

      <div className="space-y-4">
        {/* Grouped sections - sorted by group order */}
        {sortedGroups.map((g) => {
          const groupItems = byGroup.get(g.id) ?? [];
          if (groupItems.length === 0) return null;
          return (
            <GroupSection
              key={g.id}
              group={g}
              items={groupItems}
              groups={groups}
              isAdmin={isAdmin}
            />
          );
        })}
        {/* Ungrouped */}
        {hasUngroupedItems && (
          <GroupSection
            group={{ id: "__ungrouped__", name: "Chưa phân nhóm", order: 999 } as ProgramGroup}
            items={ungrouped}
            groups={groups}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  items,
  groups,
  isAdmin,
}: {
  group: ProgramGroup;
  items: ProgramItem[];
  groups: ProgramGroup[];
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await groupService.create({ name });
      if (!res.success) throw new Error((res as { error?: string }).error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "programs"] });
      setIsCreatingGroup(false);
      setNewGroupName("");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await groupService.update(id, { name });
      if (!res.success) throw new Error((res as { error?: string }).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "programs"] });
      setIsEditing(false);
    },
  });

  const handleSaveName = () => {
    if (!editName.trim() || editName === group.name) {
      setIsEditing(false);
      return;
    }
    updateGroupMutation.mutate({ id: group.id, name: editName.trim() });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate(newGroupName.trim());
  };

  const isUngrouped = group.id === "__ungrouped__";

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setIsOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {!isUngrouped && (
            <Layers className="h-4 w-4 text-muted-foreground" />
          )}
          
          {isEditing && !isUngrouped ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input
                className="h-7 py-0 px-2 text-sm max-w-[200px]"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setEditName(group.name);
                    setIsEditing(false);
                  }
                }}
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-1" onClick={handleSaveName}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => {
                setEditName(group.name);
                setIsEditing(false);
              }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <CardTitle className="text-base flex-1">{group.name}</CardTitle>
          )}
          
          <Badge variant="secondary">{items.length}</Badge>
          
          {isAdmin && !isUngrouped && !isEditing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((p) => (
              <ProgramCard key={p.assignmentId} item={p} groups={groups} isAdmin={isAdmin} />
            ))}
          </div>
          
          {/* Quick group creation for ungrouped section */}
          {isAdmin && isUngrouped && (
            <div className="mt-4 pt-4 border-t">
              {isCreatingGroup ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Tên nhóm mới..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateGroup();
                      if (e.key === "Escape") {
                        setIsCreatingGroup(false);
                        setNewGroupName("");
                      }
                    }}
                    className="max-w-[250px]"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim() || createGroupMutation.isPending}>
                    {createGroupMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupName("");
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingGroup(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Tạo nhóm mới
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ProgramCard({ item, groups, isAdmin }: { item: ProgramItem; groups: ProgramGroup[]; isAdmin: boolean }) {
  const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.not_started;
  const percent = item.progress?.percent ?? 0;
  const queryClient = useQueryClient();
  const currentGroup = groups.find((g) => g.id === item.program?.groupId);

  const updateGroupMutation = useMutation({
    mutationFn: async ({ programId, groupId }: { programId: string; groupId: string | null }) => {
      const res = await programService.update(programId, { groupId });
      if (!res.success) throw new Error((res as { error?: string }).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "programs"] });
    },
  });

  if (!item.program) return null;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="line-clamp-1 text-base">
              {item.program.title}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {item.program.description || "Không có mô tả"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={st.variant}>{st.label}</Badge>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Nhóm chương trình
                  </div>
                  <DropdownMenuItem
                    onSelect={() => updateGroupMutation.mutate({ programId: item.programId, groupId: null })}
                    disabled={!item.program.groupId}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Không nhóm
                    {!item.program.groupId && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {groups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onSelect={() => updateGroupMutation.mutate({ programId: item.programId, groupId: g.id })}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      {g.name}
                      {item.program?.groupId === g.id && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {/* Hiển thị nhóm hiện tại */}
        {isAdmin && currentGroup && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Layers className="h-3 w-3 mr-1" />
              {currentGroup.name}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tiến độ</span>
              <span className="font-medium">
                {item.progress?.completedLessons ?? 0}/
                {item.progress?.totalLessons ?? 0} ({percent}%)
              </span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
          <Button asChild className="w-full">
            <Link href={`/dashboard/programs/${item.program.id}`}>
              {item.status === "not_started" ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Bắt đầu học
                </>
              ) : (
                <>
                  Tiếp tục
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
