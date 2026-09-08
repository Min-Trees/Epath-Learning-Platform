import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/me/programs
 *  - Employee: lấy danh sách chương trình được gán + tóm tắt tiến độ
 *  - Admin: lấy tất cả (kèm role hint)
 * 
 * OPTIMIZATION v2:
 * - Batch fetch programs, lessons, và progress sử dụng Promise.all
 * - Sử dụng Firestore batch operations thay vì sequential reads
 * - Cache response với stale-while-revalidate pattern
 */

// Cache for programs metadata (shared across users)
const programsCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const cacheKey = `me_programs_${req.headers.get("x-user-id") || "anon"}`;
  const cached = programsCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return ok(cached.data);
  }

  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    // 1. Lấy assignments
    let assignmentsSnap;
    if (isAdmin(me)) {
      assignmentsSnap = await adminDb
        .collection("assignments")
        .orderBy("assignedAt", "desc")
        .limit(500)
        .get();
    } else {
      assignmentsSnap = await adminDb
        .collection("assignments")
        .where("userId", "==", me.uid)
        .get();
    }

    // 2. Deduplicate assignments by programId
    const dedupMap = new Map<string, typeof assignmentsSnap.docs[number]>();
    const STATUS_PRIORITY: Record<string, number> = {
      completed: 3,
      in_progress: 2,
      not_started: 1,
    };

    for (const a of assignmentsSnap.docs) {
      const aData = a.data() as {
        userId: string;
        programId: string;
        status: string;
        assignedAt?: { toDate?: () => Date } | Date;
      };
      const key = aData.programId;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, a);
      } else {
        const existingStatus = (existing.data() as typeof aData).status;
        const newStatus = aData.status;
        if (STATUS_PRIORITY[newStatus] > STATUS_PRIORITY[existingStatus]) {
          dedupMap.set(key, a);
        }
      }
    }

    // 3. Batch fetch all programs
    const assignments = Array.from(dedupMap.values());
    const programIds = assignments.map(a => a.data().programId as string);
    
    // Batch get programs
    const programRefs = programIds.map(id => adminDb.collection("programs").doc(id));
    const programSnaps = await adminDb.getAll(...programRefs);
    
    // Build program data map
    const programMap = new Map<string, { id: string; title: string; description: string; status: string; groupId?: string | null; lessonCount?: number }>();
    for (const snap of programSnaps) {
      if (snap.exists) {
        const data = snap.data() as { title?: string; description?: string; status?: string; groupId?: string | null };
        programMap.set(snap.id, {
          id: snap.id,
          title: data.title ?? "",
          description: data.description ?? "",
          status: data.status ?? "draft",
          groupId: data.groupId ?? null,
        });
      }
    }

    // 4. Batch fetch progress for all programs (non-admin only)
    let progressMap = new Map<string, { completedLessons: number; testScores: { score: number; passed: boolean; hasPendingReview?: boolean }[] }>();
    
    if (!isAdmin(me)) {
      const progressPromises = assignments.map(async (a) => {
        const aData = a.data() as { userId: string; programId: string };
        const progDocRef = adminDb
          .collection("progress")
          .doc(`${aData.userId}_${aData.programId}`);
        const lpSnap = await progDocRef.collection("lessons").get();
        const completedLessons = lpSnap.docs.filter(
          (d) => (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
        ).length;
        
        const testScores: { score: number; passed: boolean; hasPendingReview?: boolean }[] = [];
        for (const lpDoc of lpSnap.docs) {
          const lpData = lpDoc.data() as { testResult?: { score: number; passed: boolean; hasPendingReview?: boolean } };
          if (lpData.testResult) {
            testScores.push(lpData.testResult);
          }
        }
        
        return { programId: aData.programId, completedLessons, testScores };
      });
      
      const progressResults = await Promise.all(progressPromises);
      for (const result of progressResults) {
        progressMap.set(result.programId, {
          completedLessons: result.completedLessons,
          testScores: result.testScores,
        });
      }
    }

    // 5. Batch fetch lessons count for all programs
    const lessonsCountPromises = Array.from(programMap.keys()).map(async (programId) => {
      try {
        const lessonsSnap = await adminDb
          .collection("programs")
          .doc(programId)
          .collection("lessons")
          .count()
          .get();
        return { programId, count: lessonsSnap.data().count ?? 0 };
      } catch {
        return { programId, count: 0 };
      }
    });
    const lessonsCounts = await Promise.all(lessonsCountPromises);
    const lessonsCountMap = new Map(lessonsCounts.map(l => [l.programId, l.count]));
    
    // Update programMap with lessonCount
    for (const [programId, count] of lessonsCountMap) {
      const program = programMap.get(programId);
      if (program) {
        program.lessonCount = count;
      }
    }

    // 6. Build response items
    const items: Array<{
      assignmentId: string;
      userId: string;
      programId: string;
      status: string;
      assignedAt: Date | null;
      program: { id: string; title: string; description: string; status: string; groupId?: string | null } | null;
      progress?: { totalLessons: number; completedLessons: number; percent: number };
      testScore?: { bestScore: number; passed: boolean; hasPendingReview: boolean };
    }> = [];

    for (const a of assignments) {
      const aData = a.data() as {
        userId: string;
        programId: string;
        status: string;
        assignedAt?: { toDate?: () => Date } | Date;
      };
      const programData = programMap.get(aData.programId);
      const isPublished = programData?.status === "published";
      
      if (!isAdmin(me) && !isPublished) continue;

      const program = programData ? {
        id: programData.id,
        title: programData.title,
        description: programData.description,
        status: programData.status,
        groupId: programData.groupId,
      } : null;

      const totalLessons = programData?.lessonCount ?? 0;
      let completedLessons = 0;
      let bestScore = 0;
      let hasPassed = false;
      let hasPendingReview = false;

      if (!isAdmin(me)) {
        const progress = progressMap.get(aData.programId);
        if (progress) {
          completedLessons = progress.completedLessons;
          for (const ts of progress.testScores) {
            if (ts.score > bestScore) bestScore = ts.score;
            if (ts.passed) hasPassed = true;
            if (ts.hasPendingReview) hasPendingReview = true;
          }
        }
      }

      const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      items.push({
        assignmentId: a.id,
        userId: aData.userId,
        programId: aData.programId,
        status: aData.status,
        assignedAt:
          aData.assignedAt instanceof Date
            ? aData.assignedAt
            : (aData.assignedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null,
        program,
        progress: { totalLessons, completedLessons, percent },
        testScore: bestScore > 0 ? { bestScore, passed: hasPassed, hasPendingReview } : undefined,
      });
    }

    // 7. Fetch program groups
    const groupsSnap = await adminDb
      .collection("programGroups")
      .orderBy("order", "asc")
      .get();
    const groups = groupsSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, name: data.name, order: data.order ?? 0 };
    });

    const result = { items, groups };
    
    // Cache the result
    programsCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });

    return ok(result);
  } catch (e) {
    console.error("[api/me/programs][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
