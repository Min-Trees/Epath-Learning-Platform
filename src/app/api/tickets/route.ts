import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser } from "@/lib/api-auth";
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from "@/types/training";

const TICKETS_COLLECTION = "tickets";

// Helper to convert Firestore doc to Ticket
function docToTicket(id: string, data: Record<string, unknown>): Ticket {
  return {
    id,
    userId: data.userId as string,
    userEmail: data.userEmail as string | undefined,
    userName: data.userName as string | undefined,
    title: data.title as string,
    description: data.description as string,
    category: data.category as TicketCategory,
    priority: data.priority as TicketPriority,
    status: data.status as TicketStatus,
    screenshotUrl: data.screenshotUrl as string | undefined,
    createdAt: data.createdAt instanceof Date ? data.createdAt : new Date((data.createdAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()),
    updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt ? new Date((data.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()) : undefined,
    resolvedAt: data.resolvedAt instanceof Date ? data.resolvedAt : data.resolvedAt ? new Date((data.resolvedAt as { toDate?: () => Date })?.toDate?.()?.getTime() || Date.now()) : undefined,
    adminNote: data.adminNote as string | undefined,
  };
}

// GET /api/tickets - List all tickets (admin only)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Only admin, manager, or hr can view all tickets
  if (!["admin", "manager", "hr"].includes(user.role)) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  try {
    let query: FirebaseFirestore.Query = adminDb.collection(TICKETS_COLLECTION);

    if (status) {
      query = query.where("status", "==", status);
    }
    if (category) {
      query = query.where("category", "==", category);
    }

    query = query.orderBy("createdAt", "desc");

    const totalSnapshot = await query.count().get();
    const total = totalSnapshot.data().count;

    const offset = (page - 1) * pageSize;
    const snapshot = await query.offset(offset).limit(pageSize).get();

    const items: Ticket[] = [];
    snapshot.forEach((doc) => {
      items.push(docToTicket(doc.id, doc.data() as Record<string, unknown>));
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
    console.error("Error fetching tickets:", error);
    return Response.json({ success: false, error: "Lỗi khi tải danh sách ticket" }, { status: 500 });
  }
}

// POST /api/tickets - Create a new ticket
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, category, priority = "medium", screenshotUrl } = body;

    if (!title || !description || !category) {
      return Response.json(
        { success: false, error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    const validCategories = ["bug", "video_issue", "quiz_issue", "login_issue", "content_error", "suggestion", "other"];
    if (!validCategories.includes(category)) {
      return Response.json({ success: false, error: "Danh mục không hợp lệ" }, { status: 400 });
    }

    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(priority)) {
      return Response.json({ success: false, error: "Mức độ ưu tiên không hợp lệ" }, { status: 400 });
    }

    const ticketData = {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status: "open",
      screenshotUrl: screenshotUrl || null,
      createdAt: new Date(),
    };

    const docRef = await adminDb.collection(TICKETS_COLLECTION).add(ticketData);

    return Response.json({
      success: true,
      data: { ticketId: docRef.id },
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return Response.json({ success: false, error: "Lỗi khi tạo ticket" }, { status: 500 });
  }
}
