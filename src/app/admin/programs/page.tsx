"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Loader2,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  Search,
  Calendar,
  BarChart3,
  GraduationCap,
  GripVertical,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Check,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks";
import { programService, groupService, reorderService } from "@/services/training";
import type { Program, ProgramGroup } from "@/types/training";
import { formatDateTime } from "@/utils";

// ─── Sortable Program Card ────────────────────────────────────
function SortableProgramCard({
  program,
  isEditMode,
  groups,
  onUpdateGroup,
  isAdmin,
}: {
  program: Program;
  isEditMode: boolean;
  groups: ProgramGroup[];
  onUpdateGroup: (programId: string, groupId: string | null) => void;
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: program.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`hover:border-primary/50 transition-all group ${
          isEditMode ? "border-dashed" : ""
        }`}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch">
            {/* Left color bar */}
            <div
              className={`w-2 rounded-l-lg ${
                program.status === "published" ? "bg-green-500" : "bg-amber-500"
              }`}
            />

            {/* Drag handle */}
            {isEditMode && (
              <div
                className="flex items-center px-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-5 w-5" />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <Badge
                      variant={
                        program.status === "published" ? "success" : "secondary"
                      }
                      className="shrink-0"
                    >
                      {program.status === "published"
                        ? "Đã publish"
                        : "Bản nháp"}
                    </Badge>
                    {program.groupId && (
                      <Badge variant="outline" className="shrink-0">
                        <Layers className="h-3 w-3 mr-1" />
                        {groups.find((g) => g.id === program.groupId)?.name ?? "Nhóm"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      ID: {program.id.slice(0, 8)}...
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                    {program.title}
                  </h3>
                  {program.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {program.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Tạo: {formatDateTime(program.createdAt)}
                    </span>
                    {program.publishedAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Publish: {formatDateTime(program.publishedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isEditMode && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/programs/${program.id}`}>
                        <Eye className="mr-1 h-4 w-4" />
                        Mở
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/programs/${program.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </Link>
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/admin/assignments?programId=${program.id}`}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Gán cho nhân viên
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/reports?programId=${program.id}`}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Xem báo cáo
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/programs/${program.id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Xem như nhân viên
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Group selector in edit mode */}
                {isEditMode && (
                  <div className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Layers className="mr-1 h-4 w-4" />
                          {program.groupId
                            ? groups.find((g) => g.id === program.groupId)
                                ?.name ?? "Nhóm"
                            : "Không nhóm"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={() => onUpdateGroup(program.id, null)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Không nhóm
                          {!program.groupId && (
                            <Check className="ml-2 h-4 w-4 text-green-600" />
                          )}
                        </DropdownMenuItem>
                        {groups.map((g) => (
                          <DropdownMenuItem
                            key={g.id}
                            onSelect={() => onUpdateGroup(program.id, g.id)}
                          >
                            <Layers className="mr-2 h-4 w-4" />
                            {g.name}
                            {program.groupId === g.id && (
                              <Check className="ml-2 h-4 w-4 text-green-600" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sortable Group Header ────────────────────────────────────
function SortableGroupSection({
  group,
  programs,
  isEditMode,
  allGroups,
  onUpdateGroup,
  onDeleteGroup,
  onDeleteProgram,
  deletingId,
  isAdmin,
  onUpdateGroupName,
}: {
  group: ProgramGroup;
  programs: Program[];
  isEditMode: boolean;
  allGroups: ProgramGroup[];
  onUpdateGroup: (programId: string, groupId: string | null) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteProgram: (p: Program) => void;
  deletingId: string | null;
  isAdmin: boolean;
  onUpdateGroupName: (groupId: string, name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `group-${group.id}`, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 mb-2 mt-6 first:mt-0">
        {isEditMode && (
          <div
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {isEditingName ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                className="h-6 py-0 px-1 text-sm font-semibold w-40"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdateGroupName(group.id, nameValue);
                    setIsEditingName(false);
                  }
                  if (e.key === "Escape") {
                    setNameValue(group.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1"
                onClick={() => {
                  onUpdateGroupName(group.id, nameValue);
                  setIsEditingName(false);
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <h3 className="font-semibold text-sm uppercase tracking-wide">
              {group.name}
            </h3>
          )}
        </button>
        <Badge variant="secondary" className="text-xs">
          {programs.length}
        </Badge>
        {isEditMode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-muted-foreground hover:text-foreground ml-auto"
            onClick={() => setIsEditingName(true)}
          >
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {isEditMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteGroup(group.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-3">
          {programs.map((p) => (
            <SortableProgramCard
              key={p.id}
              program={p}
              isEditMode={isEditMode}
              groups={allGroups}
              onUpdateGroup={onUpdateGroup}
              isAdmin={isAdmin}
            />
          ))}
          {programs.length === 0 && !isEditMode && (
            <p className="text-sm text-muted-foreground py-2">
              Không có chương trình trong nhóm này.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Groups Tab Content Component ─────────────────────────────────
function GroupsTabContent({
  groups,
  programs,
  isLoading,
  newGroupName,
  setNewGroupName,
  createGroup,
  handleCreateGroup,
  handleUpdateGroupName,
  handleDeleteGroup,
  handleUpdateGroup,
}: {
  groups: ProgramGroup[];
  programs: Program[];
  isLoading: boolean;
  newGroupName: string;
  setNewGroupName: (value: string) => void;
  createGroup: UseMutationResult<{ groupId: string }, Error, string>;
  handleCreateGroup: () => void;
  handleUpdateGroupName: (groupId: string, name: string) => void;
  handleDeleteGroup: (groupId: string) => void;
  handleUpdateGroup: (programId: string, groupId: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Danh sách nhóm</h2>
          <p className="text-sm text-muted-foreground">
            Tạo và quản lý các nhóm chương trình đào tạo
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Tên nhóm mới..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
            className="w-64"
          />
          <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || createGroup.isPending}>
            {createGroup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Thêm nhóm
          </Button>
        </div>
      </div>

      {/* Groups List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Chưa có nhóm nào</h3>
            <p className="text-muted-foreground">Tạo nhóm để phân loại chương trình đào tạo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const groupPrograms = programs.filter((p) => p.groupId === g.id);
            return (
              <Card key={g.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{g.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => {
                        const newName = window.prompt("Đổi tên nhóm:", g.name);
                        if (newName && newName.trim()) handleUpdateGroupName(g.id, newName.trim());
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteGroup(g.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{groupPrograms.length} chương trình</span>
                  </div>
                  {groupPrograms.length > 0 ? (
                    <div className="space-y-2">
                      {groupPrograms.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-sm group-item">
                          <Badge variant={p.status === "published" ? "success" : "secondary"} className="shrink-0">
                            {p.status === "published" ? "Đã publish" : "Nháp"}
                          </Badge>
                          <span className="truncate flex-1">{p.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Xóa "${p.title}" khỏi nhóm "${g.name}"?`)) {
                                handleUpdateGroup(p.id, null);
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {groupPrograms.length > 5 && <p className="text-xs text-muted-foreground">+{groupPrograms.length - 5} chương trình khác</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Chưa có chương trình nào</p>
                  )}
                  {programs.filter((p) => !p.groupId).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Di chuyển chương trình:</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full"><Plus className="mr-1 h-4 w-4" />Thêm chương trình</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          {programs.filter((p) => !p.groupId).map((p) => (
                            <DropdownMenuItem key={p.id} onSelect={() => handleUpdateGroup(p.id, g.id)}>
                              <BookOpen className="mr-2 h-4 w-4" /><span className="truncate">{p.title}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ungrouped Programs */}
      {programs.filter((p) => !p.groupId).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Chương trình chưa phân nhóm
              <Badge variant="secondary">{programs.filter((p) => !p.groupId).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {programs.filter((p) => !p.groupId).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-3">
                    <Badge variant={p.status === "published" ? "success" : "secondary"}>
                      {p.status === "published" ? "Đã publish" : "Nháp"}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{p.title}</p>
                      {p.description && <p className="text-xs text-muted-foreground truncate max-w-md">{p.description}</p>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm"><Layers className="mr-1 h-4 w-4" />Chọn nhóm</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {groups.map((g) => (
                        <DropdownMenuItem key={g.id} onSelect={() => handleUpdateGroup(p.id, g.id)}>
                          <Layers className="mr-2 h-4 w-4" />{g.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminProgramsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const canDelete = user?.role === "admin";
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [localPrograms, setLocalPrograms] = useState<Program[] | null>(null);
  const [localGroups, setLocalGroups] = useState<ProgramGroup[] | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"programs" | "groups">("programs");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ─── Fetch programs + groups ───────────────────────────────
  const {
    data: rawData,
    isLoading,
    error: rqError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["programs", "list", "all"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await programService.list();
      if (!res.success || !res.data) {
        throw new Error(
          (res as { error?: string }).error ?? "Lỗi tải chương trình"
        );
      }
      const data = res.data as { items: Program[]; groups?: ProgramGroup[] };
      const groups: ProgramGroup[] = data.groups ?? [];

      const normalizeDate = (p: Program) => ({
        ...p,
        createdAt: new Date(
          (p as unknown as { createdAt?: { toDate?: () => Date } | Date })
            .createdAt instanceof Date
            ? ((p as unknown as { createdAt: Date }).createdAt as unknown as Date)
            : ((p as unknown as { createdAt?: { toDate?: () => Date } })
                .createdAt?.toDate?.() ?? new Date())
        ),
        // Ensure order is a number (default 0)
        order: typeof (p as unknown as { order?: number }).order === "number"
          ? ((p as unknown as { order: number }).order)
          : 0,
      });

      const items = (data.items ?? []).map(normalizeDate);

      // Sort by order within each group; ungrouped at the end
      const itemsByGroup = new Map<string | null, Program[]>();
      itemsByGroup.set(null, []);
      for (const g of groups) itemsByGroup.set(g.id, []);
      for (const p of items) {
        const gId = p.groupId ?? null;
        if (!itemsByGroup.has(gId)) itemsByGroup.set(gId, []);
        itemsByGroup.get(gId)!.push(p);
      }
      for (const arr of itemsByGroup.values()) {
        (arr as Array<Program & { order: number }>).sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0)
        );
      }
      const sortedItems = [
        ...itemsByGroup.get(null)!,
        ...groups.flatMap((g) => itemsByGroup.get(g.id) ?? []),
      ];

      return {
        items: sortedItems,
        groups,
      };
    },
  });

  const programs = localPrograms ?? rawData?.items ?? [];
  const groups = localGroups ?? rawData?.groups ?? [];

  const filtered = useMemo(() => {
    let result = programs;
    if (filter !== "all") {
      result = result.filter((p) => p.status === filter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          (p.description ?? "").toLowerCase().includes(query)
      );
    }
    return result;
  }, [programs, filter, searchQuery]);

  const stats = useMemo(
    () => ({
      total: programs.length,
      published: programs.filter((p) => p.status === "published").length,
      draft: programs.filter((p) => p.status === "draft").length,
    }),
    [programs]
  );

  const error = rqError
    ? rqError instanceof Error
      ? rqError.message
      : String(rqError)
    : null;

  // ─── Programs by group ──────────────────────────────────
  const programsByGroup = useMemo(() => {
    const map = new Map<string | null, Program[]>();
    map.set(null, []);
    for (const g of groups) map.set(g.id, []);
    for (const p of filtered) {
      const gId = p.groupId ?? null;
      if (!map.has(gId)) map.set(gId, []);
      map.get(gId)!.push(p);
    }
    // Sort by order within each group
    for (const arr of map.values()) {
      (arr as Array<Program & { order: number }>).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
    }
    return map;
  }, [filtered, groups]);

  // ─── Mutations ──────────────────────────────────────────
  const deleteProgram = useMutation({
    mutationFn: async (programId: string) => {
      const res = await programService.remove(programId);
      if (!res.success) {
        throw new Error(
          (res as { error?: string }).error ?? "Xóa chương trình thất bại"
        );
      }
      return programId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      const res = await groupService.create({ name });
      if (!res.success) throw new Error((res as { error?: string }).error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
      setNewGroupName("");
    },
  });

  const updateGroupName = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await groupService.update(id, { name });
      if (!res.success) throw new Error((res as { error?: string }).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await groupService.remove(groupId);
      if (!res.success) throw new Error((res as { error?: string }).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
    },
  });

  const updateProgramGroup = useMutation({
    mutationFn: async ({
      programId,
      groupId,
    }: {
      programId: string;
      groupId: string | null;
    }) => {
      const res = await programService.update(programId, { groupId });
      if (!res.success) throw new Error((res as { error?: string }).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
    },
  });

  const handleDelete = (p: Program) => {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Xóa chương trình "${p.title}"?\n\nToàn bộ bài học, bài kiểm tra, lượt gán và tiến độ học viên sẽ bị xóa và không thể khôi phục.`
    );
    if (!confirmed) return;
    setDeletingId(p.id);
    deleteProgram.mutate(p.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    const g = groups.find((g) => g.id === groupId);
    if (!g) return;
    const confirmed = window.confirm(
      `Xóa nhóm "${g.name}"?\n\nCác chương trình trong nhóm sẽ được chuyển ra ngoài nhóm.`
    );
    if (!confirmed) return;
    deleteGroup.mutate(groupId);
  };

  const handleUpdateGroupName = (groupId: string, name: string) => {
    if (!name.trim()) return;
    updateGroupName.mutate({ id: groupId, name: name.trim() });
  };

  const handleUpdateGroup = (programId: string, groupId: string | null) => {
    updateProgramGroup.mutate({ programId, groupId });
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    createGroup.mutate(name);
  };

  // ─── DnD Handler ────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Prevent concurrent saves
    if (saving) return;

    const activeIdStr = String(active.id);

    // ── Group reorder ──
    if (activeIdStr.startsWith("group-") && String(over.id).startsWith("group-")) {
      const fromIdx = groups.findIndex((g) => `group-${g.id}` === activeIdStr);
      const toIdx = groups.findIndex((g) => `group-${g.id}` === String(over.id));
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = arrayMove(groups, fromIdx, toIdx).map((g, i) => ({
          ...g,
          order: i,
        }));
        queryClient.setQueryData(["programs", "list", "all"], (old: { items: Program[]; groups: ProgramGroup[] } | undefined) =>
          old ? { ...old, groups: reordered } : old
        );
        setLocalGroups(reordered);
        setSaving(true);
        reorderService
          groupService.reorder(reordered.map((g) => ({ id: g.id, order: g.order })))
          .then((res) => { if (!res.success) console.error("Failed to reorder groups:", res); })
          .finally(() => setSaving(false));
      }
      return;
    }

    // ── Program reorder ──
    const activeProgram = programs.find((p) => p.id === active.id);
    if (!activeProgram) return;

    const overIdStr = String(over.id);
    const overIsGroup = overIdStr.startsWith("group-");
    const overProgram = overIsGroup ? null : programs.find((p) => p.id === over.id);
    const activeGroupId = activeProgram.groupId ?? null;
    const overGroupId = overIsGroup
      ? groups.find((g) => `group-${g.id}` === overIdStr)?.id ?? null
      : (overProgram?.groupId ?? null);

    // Source list
    const srcList = [...(programsByGroup.get(activeGroupId) ?? [])];
    const fromIdx = srcList.findIndex((p) => p.id === active.id);
    if (fromIdx === -1) return;

    // Destination list (copy unless same group)
    const dstList =
      activeGroupId === overGroupId
        ? srcList
        : overIsGroup
        ? ([] as Program[])
        : [...(programsByGroup.get(overGroupId) ?? [])];

    srcList.splice(fromIdx, 1);

    let insertAt: number;
    if (overIsGroup) {
      insertAt = 0; // drop on group header = top of that group
    } else {
      insertAt = dstList.findIndex((p) => p.id === over.id);
      if (insertAt === -1) insertAt = dstList.length;
    }

    if (activeGroupId === overGroupId) {
      srcList.splice(insertAt, 0, activeProgram);
    } else {
      dstList.splice(insertAt, 0, { ...activeProgram, groupId: overGroupId });
    }

    // Build fully updated programs array with correct order/groupId
    type OrderedProgram = Program & { order: number };
    const updatedPrograms: OrderedProgram[] = programs.map((p) => {
      const sIdx = srcList.findIndex((x) => x.id === p.id);
      if (sIdx !== -1) return { ...p, order: sIdx, groupId: activeGroupId } as OrderedProgram;
      const dIdx = dstList.findIndex((x) => x.id === p.id);
      if (dIdx !== -1) return { ...p, order: dIdx, groupId: overGroupId } as OrderedProgram;
      return { ...p, order: (p as unknown as { order?: number }).order ?? 0 } as OrderedProgram;
    });

    // Update both React Query cache and local state so UI stays in sync
    queryClient.setQueryData(["programs", "list", "all"], (old: { items: Program[]; groups: ProgramGroup[] } | undefined) =>
      old ? { ...old, items: updatedPrograms } : old
    );
    setLocalPrograms(updatedPrograms);

    setSaving(true);
    reorderService
      .programs(updatedPrograms.map((p) => ({
        id: p.id,
        order: (p as Program & { order?: number }).order ?? 0,
        groupId: p.groupId ?? null,
      })))
      .then((res) => { if (!res.success) console.error("Failed to reorder programs:", res); })
      .finally(() => setSaving(false));
  };

  // ─── Edit mode enter/exit ────────────────────────────────
  const enterEditMode = () => {
    setLocalPrograms(rawData?.items ?? null);
    setLocalGroups(rawData?.groups ?? null);
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    setLocalPrograms(null);
    setLocalGroups(null);
    setIsEditMode(false);
    queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
  };

  return (
    <PageContainer
      title="Quản lý chương trình đào tạo"
      description="Tạo, chỉnh sửa và quản lý các chương trình đào tạo"
      showBreadcrumb={false}
      actions={
        isAdmin ? (
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {saving ? "Đang lưu..." : ""}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exitEditMode}
                  disabled={saving}
                >
                  <X className="mr-1 h-4 w-4" />
                  Hủy
                </Button>
                <Button size="sm" onClick={exitEditMode} disabled={saving}>
                  <Check className="mr-1 h-4 w-4" />
                  Xong
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enterEditMode}
                >
                  <Layers className="mr-1 h-4 w-4" />
                  Sắp xếp
                </Button>
                <Button asChild>
                  <Link href="/admin/programs/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo chương trình mới
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : null
      }
    >
      {user && !isAdmin && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ{" "}
            <strong>admin</strong> hoặc <strong>manager</strong> mới có quyền
            truy cập.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tổng số chương trình
                </p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Đã publish
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.published}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bản nháp
                </p>
                <p className="text-3xl font-bold text-amber-600">
                  {stats.draft}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Edit className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b">
        <nav className="flex gap-1 -mb-px">
          <button
            onClick={() => setActiveTab("programs")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "programs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Chương trình
            <Badge variant="secondary" className="ml-1">{stats.total}</Badge>
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "groups"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            <Layers className="h-4 w-4" />
            Nhóm chương trình
            <Badge variant="secondary" className="ml-1">{groups.length}</Badge>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "programs" ? (
        <>
          {/* Edit Mode: Group Manager */}
          {isEditMode && (
        <Card className="mb-6 border-dashed border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Quản lý nhóm
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Group list — sortable via the main edit-mode DndContext */}
            <div className="space-y-1 mb-3">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <span className="flex-1 font-medium text-sm">{g.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteGroup(g.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Chưa có nhóm nào.
                </p>
              )}
            </div>

            {/* Add group */}
            <div className="flex gap-2">
              <Input
                placeholder="Tên nhóm mới..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateGroup();
                }}
                className="max-w-xs"
              />
              <Button
                size="sm"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || createGroup.isPending}
              >
                <Plus className="mr-1 h-4 w-4" />
                Thêm nhóm
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm chương trình..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {(["all", "draft", "published"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "Tất cả" : s === "draft" ? "Bản nháp" : "Đã publish"}
              {s !== "all" && (
                <Badge variant="secondary" className="ml-2">
                  {s === "draft" ? stats.draft : stats.published}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Program List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 && !isEditMode ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "Không tìm thấy chương trình" : "Chưa có chương trình nào"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? `Không có kết quả cho "${searchQuery}"`
                : "Tạo chương trình đào tạo đầu tiên của bạn"}
            </p>
            {isAdmin && !searchQuery && (
              <Button asChild>
                <Link href="/admin/programs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo chương trình mới
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : isEditMode ? (
        /* ── Edit Mode: grouped sortable list ── */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div>
            {/* Ungrouped section */}
            {(() => {
              const ungrouped = programsByGroup.get(null) ?? [];
              if (ungrouped.length === 0) return null;
              return (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Không nhóm
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {ungrouped.length}
                    </Badge>
                  </div>
                  <SortableContext
                    items={ungrouped.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {ungrouped.map((p) => (
                        <SortableProgramCard
                          key={p.id}
                          program={p}
                          isEditMode={isEditMode}
                          groups={groups}
                          onUpdateGroup={handleUpdateGroup}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })()}

            {/* Grouped sections */}
            {groups.map((g) => {
              const groupPrograms = programsByGroup.get(g.id) ?? [];
              return (
                <SortableGroupSection
                  key={g.id}
                  group={g}
                  programs={groupPrograms}
                  isEditMode={isEditMode}
                  allGroups={groups}
                  onUpdateGroup={handleUpdateGroup}
                  onDeleteGroup={handleDeleteGroup}
                  onDeleteProgram={handleDelete}
                  deletingId={deletingId}
                  isAdmin={isAdmin}
                  onUpdateGroupName={handleUpdateGroupName}
                />
              );
            })}

            {/* Empty state */}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Không có chương trình nào.
                </CardContent>
              </Card>
            )}
          </div>

        </DndContext>
      ) : (
        /* ── Normal mode: flat grid ── */
        <div className="grid gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="hover:border-primary/50 transition-all group"
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  <div
                    className={`w-2 rounded-l-lg ${
                      p.status === "published" ? "bg-green-500" : "bg-amber-500"
                    }`}
                  />
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={p.status === "published" ? "success" : "secondary"}
                            className="shrink-0"
                          >
                            {p.status === "published" ? "Đã publish" : "Bản nháp"}
                          </Badge>
                          {p.groupId && groups.find((g) => g.id === p.groupId) && (
                            <Badge variant="outline" className="shrink-0">
                              <Layers className="h-3 w-3 mr-1" />
                              {groups.find((g) => g.id === p.groupId)?.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground truncate">
                            ID: {p.id.slice(0, 8)}...
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                        {p.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Tạo: {formatDateTime(p.createdAt)}
                          </span>
                          {p.publishedAt && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Publish: {formatDateTime(p.publishedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/programs/${p.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Mở
                          </Link>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/programs/${p.id}`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/assignments?programId=${p.id}`}
                                  >
                                    <Users className="mr-2 h-4 w-4" />
                                    Gán cho nhân viên
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/reports?programId=${p.id}`}
                                  >
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Xem báo cáo
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/programs/${p.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Xem như nhân viên
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <>
                                <div className="my-1 h-px bg-border" />
                                <DropdownMenuItem
                                  onSelect={() => handleDelete(p)}
                                  disabled={deletingId === p.id}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  {deletingId === p.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                  )}
                                  Xóa chương trình
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </>
      ) : (
        /* ── Groups Tab ── */
        <GroupsTabContent
          groups={groups}
          programs={programs}
          isLoading={isLoading}
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          createGroup={createGroup as unknown as UseMutationResult<{ groupId: string }, Error, string>}
          handleCreateGroup={handleCreateGroup}
          handleUpdateGroupName={handleUpdateGroupName}
          handleDeleteGroup={handleDeleteGroup}
          handleUpdateGroup={handleUpdateGroup}
        />
      )}

      {/* Quick Actions */}
      {!isLoading && programs.length > 0 && !isEditMode && activeTab === "programs" && (
        <div className="mt-8 p-6 rounded-lg border bg-muted/30 text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Cần hỗ trợ?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Xem hướng dẫn sử dụng hoặc liên hệ quản trị viên
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" asChild>
              <Link href="/admin/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Xem báo cáo
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild>
                <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  Quản lý người dùng
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
