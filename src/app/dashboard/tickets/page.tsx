"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bug,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDialog } from "@/components/ticket/ticket-dialog";
import { ticketService } from "@/services/training";
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from "@/types/training";
import {
  formatDistanceToNow,
  format,
} from "date-fns";
import { vi } from "date-fns/locale";

const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Mới", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
  in_progress: { label: "Đang xử lý", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  resolved: { label: "Đã giải quyết", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  closed: { label: "Đã đóng", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Thấp", color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400" },
  medium: { label: "Trung bình", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "Cao", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Khẩn cấp", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const categoryLabels: Record<TicketCategory, string> = {
  bug: "Lỗi hệ thống",
  video_issue: "Lỗi video",
  quiz_issue: "Lỗi bài kiểm tra",
  login_issue: "Lỗi đăng nhập",
  content_error: "Nội dung sai",
  suggestion: "Đề xuất cải thiện",
  other: "Khác",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pageSize = 10;

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ticketService.getMyTickets({ page, pageSize });
      if (res.success && res.data) {
        setTickets(res.data.items);
        setTotal(res.data.total);
      }
    } catch (e) {
      console.error("Error fetching tickets:", e);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (date: Date) => {
    try {
      return format(date, "dd/MM/yyyy HH:mm", { locale: vi });
    } catch {
      return "";
    }
  };

  const formatRelativeDate = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: vi });
    } catch {
      return "";
    }
  };

  return (
    <PageContainer
      title="Báo cáo lỗi"
      description="Xem và quản lý các yêu cầu hỗ trợ của bạn"
      showBreadcrumb={false}
      actions={
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Gửi yêu cầu mới
        </Button>
      }
    >
      <TicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          void fetchTickets();
        }}
      />

      {/* Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mới</p>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "open").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đang xử lý</p>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "in_progress").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đã giải quyết</p>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "resolved").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-900/30">
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đã đóng</p>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "closed").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Danh sách yêu cầu ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-20 w-20 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bug className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Chưa có yêu cầu nào</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Bạn chưa gửi yêu cầu hỗ trợ nào. Nếu gặp lỗi hoặc vấn đề, hãy gửi yêu cầu để được hỗ trợ.
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Gửi yêu cầu đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status];
                const priority = priorityConfig[ticket.priority];
                const StatusIcon = status.icon;
                return (
                  <div
                    key={ticket.id}
                    className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-semibold truncate">{ticket.title}</h3>
                          <Badge className={priority.color} variant="secondary">
                            {priority.label}
                          </Badge>
                          <Badge className={status.color} variant="secondary">
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="bg-muted px-2 py-1 rounded">
                            {categoryLabels[ticket.category]}
                          </span>
                          <span title={formatDate(ticket.createdAt)}>
                            {formatRelativeDate(ticket.createdAt)}
                          </span>
                          {ticket.adminNote && (
                            <span className="text-green-600 dark:text-green-400">
                              💬 {ticket.adminNote.substring(0, 50)}
                              {ticket.adminNote.length > 50 ? "..." : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Trước
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Trang {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Sau
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
