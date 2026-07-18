import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/admin/stats
 * Trả về các thông số tổng quan cho Bảng điều khiển quản trị.
 *
 * Stats hiện tại (lấy trực tiếp từ Firestore):
 *   - totalUsers            : số users đang active (users.isActive != false)
 *   - totalCourses          : số khóa học đã publish (programs.status === "published")
 *   - totalEnrollments      : tổng assignments
 *   - totalCompletions      : tổng assignments có status === "completed"
 *   - averageCompletionRate : % hoàn thành (totalCompletions / totalEnrollments * 100)
 *   - activeUsersThisMonth  : số user có lastActiveAt trong 30 ngày gần nhất
 *   - newUsersThisMonth     : số user tạo mới trong 30 ngày gần nhất
 *
 * Chỉ admin mới được gọi.
 */
export const dynamic = "force-dynamic";

interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalCompletions: number;
  averageCompletionRate: number;
  activeUsersThisMonth: number;
  newUsersThisMonth: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function safeCount(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
): Promise<number> {
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    // Fallback cho trường hợp .count() chưa được hỗ trợ - dùng where('__name__', '!=', '')
    try {
      const fallback = await query.get();
      return fallback.size;
    } catch {
      return 0;
    }
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized - cần đăng nhập", 401);
  if (!user.isAdmin) return bad("Forbidden - chỉ admin mới có quyền", 403);

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceTs = startOfDay(since);

    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCompletions,
      newUsersThisMonth,
    ] = await Promise.all([
      safeCount(adminDb.collection("users").where("isActive", "!=", false)),
      safeCount(
        adminDb
          .collection("programs")
          .where("status", "==", "published")
      ),
      safeCount(adminDb.collection("assignments")),
      safeCount(
        adminDb
          .collection("assignments")
          .where("status", "==", "completed")
      ),
      safeCount(
        adminDb
          .collection("users")
          .where("createdAt", ">=", sinceTs)
      ),
    ]);

    // Active users this month: ưu tiên dùng lastActiveAt (timestamp),
    // fallback đếm theo assignment.assignedAt nếu chưa có lastActiveAt.
    let activeUsersThisMonth = 0;
    try {
      const lastActiveSnap = await adminDb
        .collection("users")
        .where("lastActiveAt", ">=", sinceTs)
        .get();
      activeUsersThisMonth = lastActiveSnap.size;
    } catch {
      activeUsersThisMonth = 0;
    }

    const averageCompletionRate =
      totalEnrollments > 0
        ? Math.round((totalCompletions / totalEnrollments) * 100)
        : 0;

    const stats: AdminStats = {
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCompletions,
      averageCompletionRate,
      activeUsersThisMonth,
      newUsersThisMonth,
    };

    return ok(stats);
  } catch (e) {
    console.error("[api/admin/stats] error:", e);
    return bad(
      `Không thể lấy thống kê: ${e instanceof Error ? e.message : String(e)}`,
      500
    );
  }
}
