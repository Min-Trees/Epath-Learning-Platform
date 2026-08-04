import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser } from "@/lib/api-auth";

const TICKETS_COLLECTION = "tickets";

// GET /api/tickets/[id] - Get single ticket
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const doc = await adminDb.collection(TICKETS_COLLECTION).doc(id).get();

    if (!doc.exists) {
      return Response.json({ success: false, error: "Ticket không tồn tại" }, { status: 404 });
    }

    const data = doc.data()!;

    // Check access: user can only view their own ticket unless they're admin
    if (data.userId !== user.uid && !["admin", "manager", "hr"].includes(user.role)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return Response.json({
      success: true,
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        resolvedAt: data.resolvedAt?.toDate?.() || data.resolvedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return Response.json({ success: false, error: "Lỗi khi tải ticket" }, { status: 500 });
  }
}

// PUT /api/tickets/[id] - Update ticket status (admin) or add note
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const docRef = adminDb.collection(TICKETS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return Response.json({ success: false, error: "Ticket không tồn tại" }, { status: 404 });
    }

    const data = doc.data()!;

    // Check access
    if (data.userId !== user.uid && !["admin", "manager", "hr"].includes(user.role)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, adminNote, priority } = body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Admin can update status and priority
    if (["admin", "manager", "hr"].includes(user.role)) {
      if (status) {
        const validStatuses = ["open", "in_progress", "resolved", "closed"];
        if (!validStatuses.includes(status)) {
          return Response.json({ success: false, error: "Trạng thái không hợp lệ" }, { status: 400 });
        }
        updateData.status = status;
        if (status === "resolved" || status === "closed") {
          updateData.resolvedAt = new Date();
        }
      }
      if (priority) {
        const validPriorities = ["low", "medium", "high", "urgent"];
        if (!validPriorities.includes(priority)) {
          return Response.json({ success: false, error: "Mức độ ưu tiên không hợp lệ" }, { status: 400 });
        }
        updateData.priority = priority;
      }
      if (adminNote !== undefined) {
        updateData.adminNote = adminNote;
      }
    }

    await docRef.update(updateData);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return Response.json({ success: false, error: "Lỗi khi cập nhật ticket" }, { status: 500 });
  }
}

// DELETE /api/tickets/[id] - Delete ticket (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!["admin"].includes(user.role)) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await adminDb.collection(TICKETS_COLLECTION).doc(id).delete();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return Response.json({ success: false, error: "Lỗi khi xóa ticket" }, { status: 500 });
  }
}
