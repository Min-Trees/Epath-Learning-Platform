import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { ProgramGroup, Program } from "@/types/training";

// ─── Groups ────────────────────────────────────────────────
export const groupService = {
  list: () => apiGet<{ items: ProgramGroup[] }>("/api/groups"),
  create: (data: { name: string }) =>
    apiPost<{ groupId: string }>("/api/groups", data),
  update: (id: string, data: { name: string }) =>
    apiPut(`/api/groups/${id}`, data),
  remove: (id: string) => apiDelete(`/api/groups/${id}`),
  reorder: (groups: { id: string; order: number }[]) =>
    apiPut("/api/groups/reorder", { groups }),
};

// ─── Reorder ────────────────────────────────────────────────
export const reorderService = {
  programs: (programs: { id: string; order: number; groupId?: string | null }[]) =>
    apiPut("/api/programs/reorder", { programs }),
  lessons: (
    programId: string,
    lessons: { id: string; order: number }[]
  ) => apiPut(`/api/programs/${programId}/lessons/reorder`, { lessons }),
};
