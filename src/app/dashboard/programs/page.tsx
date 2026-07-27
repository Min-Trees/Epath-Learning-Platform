"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Play,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks";
import { myProgramsService } from "@/services/training";
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
            />
          )}
          {completed.length > 0 && (
            <ProgramsByGroup
              label="Đã hoàn thành"
              items={completed}
              groups={groups}
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
}: {
  label: string;
  items: ProgramItem[];
  groups: ProgramGroup[];
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

  const hasGroups = groups.length > 0;

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
        {label} ({items.length})
      </h2>

      {hasGroups ? (
        <div className="space-y-4">
          {/* Grouped sections */}
          {groups.map((g) => {
            const groupItems = byGroup.get(g.id) ?? [];
            if (groupItems.length === 0) return null;
            return (
              <GroupSection
                key={g.id}
                group={g}
                items={groupItems}
              />
            );
          })}
          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <GroupSection
              group={{ id: "__ungrouped__", name: "Không nhóm" } as ProgramGroup}
              items={ungrouped}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <ProgramCard key={p.assignmentId} item={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  group,
  items,
}: {
  group: ProgramGroup;
  items: ProgramItem[];
}) {
  const [isOpen, setIsOpen] = useState(true);

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
          {group.id !== "__ungrouped__" && (
            <Layers className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-base flex-1">{group.name}</CardTitle>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((p) => (
              <ProgramCard key={p.assignmentId} item={p} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ProgramCard({ item }: { item: ProgramItem }) {
  if (!item.program) return null;
  const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.not_started;
  const percent = item.progress?.percent ?? 0;
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
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
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
