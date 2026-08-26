import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser } from "@/lib/api-auth";
import type { Ticket } from "@/types/training";

const TICKETS_COLLECTION = "tickets";

// GET /api/tickets/my - Get current user's tickets
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");

  try {
    // Query tickets by userId (single field, no composite index needed)
    const query = adminDb
      .collection(TICKETS_COLLECTION)
      .where("userId", "==", user.uid);

    // Get total count
    const totalSnapshot = await query.count().get();
    const total = totalSnapshot.data().count;

    // Get paginated results with order
    const offset = (page - 1) * pageSize;
    const snapshot = await query
      .orderBy("createdAt", "desc")
      .offset(offset)
      .limit(pageSize)
      .get();

    const items: Ticket[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        userId: data.userId as string,
        userEmail: data.userEmail as string | undefined,
        userName: data.userName as string | undefined,
        title: data.title as string,
        description: data.description as string,
        category: data.category as Ticket["category"],
        priority: data.priority as Ticket["priority"],
        status: data.status as Ticket["status"],
        screenshotUrl: data.screenshotUrl as string | undefined,
        createdAt: new Date((data.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()),
        updatedAt: data.updatedAt ? new Date((data.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()) : undefined,
        resolvedAt: data.resolvedAt ? new Date((data.resolvedAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()) : undefined,
        adminNote: data.adminNote as string | undefined,
      });
    });

    return Response.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return Response.json({ success: false, error: "Lỗi khi tải danh sách ticket" }, { status: 500 });
  }
}
