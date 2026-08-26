"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bug,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ticketService } from "@/services/training";
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from "@/types/training";
import { formatDistanceToNow, format } from "date-fns";
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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected ticket for detail/edit
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<TicketStatus>("open");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pageSize = 20;

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { status?: string; category?: string; page?: number; pageSize?: number } = {
        page,
        pageSize,
      };
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterCategory !== "all") params.category = filterCategory;

      const res = await ticketService.list(params);
      if (res.success && res.data) {
        setTickets(res.data.items);
        setTotal(res.data.total);
        setTotalPages(Math.ceil(res.data.total / pageSize));
      }
    } catch (e) {
      console.error("Error fetching tickets:", e);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filterStatus, filterCategory]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

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

  const openTicketDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setAdminNote(ticket.adminNote || "");
    setNewStatus(ticket.status);
    setNewPriority(ticket.priority);
    setUpdateError(null);
    setUpdateSuccess(false);
    setDetailDialogOpen(true);
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      const res = await ticketService.updateStatus(selectedTicket.id, newStatus, adminNote);
      if (res.success) {
        setUpdateSuccess(true);
        setTimeout(() => {
          setDetailDialogOpen(false);
          void fetchTickets();
        }, 1500);
      } else {
        setUpdateError((res as { error?: string }).error || "Không thể cập nhật ticket");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicket) return;

    setIsDeleting(true);
    try {
      const res = await ticketService.delete(selectedTicket.id);
      if (res.success) {
        setDeleteDialogOpen(false);
        setDetailDialogOpen(false);
        void fetchTickets();
      } else {
        setUpdateError((res as { error?: string }).error || "Không thể xóa ticket");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter tickets by search query
  const filteredTickets = tickets.filter((ticket) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.title.toLowerCase().includes(query) ||
      ticket.description.toLowerCase().includes(query) ||
      ticket.userEmail?.toLowerCase().includes(query) ||
      ticket.userName?.toLowerCase().includes(query)
    );
  });

  // Stats
  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <PageContainer
      title="Quản lý Tickets"
      description="Xem và xử lý các yêu cầu hỗ trợ từ người dùng"
    >
      {/* Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-900/30">
              <Bug className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng số</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mới</p>
              <p className="text-2xl font-bold">{stats.open}</p>
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
              <p className="text-2xl font-bold">{stats.inProgress}</p>
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
              <p className="text-2xl font-bold">{stats.resolved}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm tiêu đề, mô tả, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter by Status */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="open">Mới</SelectItem>
                <SelectItem value="in_progress">Đang xử lý</SelectItem>
                <SelectItem value="resolved">Đã giải quyết</SelectItem>
                <SelectItem value="closed">Đã đóng</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter by Category */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Danh mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="bug">Lỗi hệ thống</SelectItem>
                <SelectItem value="video_issue">Lỗi video</SelectItem>
                <SelectItem value="quiz_issue">Lỗi bài kiểm tra</SelectItem>
                <SelectItem value="login_issue">Lỗi đăng nhập</SelectItem>
                <SelectItem value="content_error">Nội dung sai</SelectItem>
                <SelectItem value="suggestion">Đề xuất</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button variant="outline" onClick={() => void fetchTickets()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ticket List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Danh sách Tickets ({filteredTickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
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
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bug className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Không có ticket nào</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Không tìm thấy ticket nào phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const status = statusConfig[ticket.status];
                const priority = priorityConfig[ticket.priority];
                const StatusIcon = status.icon;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => openTicketDetail(ticket)}
                    className="rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer"
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
                          <Badge variant="outline">
                            {categoryLabels[ticket.category]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">👤</span>
                            {ticket.userName || ticket.userEmail}
                          </span>
                          <span title={formatDate(ticket.createdAt)}>
                            {formatRelativeDate(ticket.createdAt)}
                          </span>
                          {ticket.adminNote && (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Đã phản hồi
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
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

      {/* Ticket Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Chi tiết Ticket
            </DialogTitle>
            <DialogDescription>
              Xem và cập nhật trạng thái ticket
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {updateSuccess ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Cập nhật thành công!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ticket đã được cập nhật thông tin thành công.
                  </p>
                </div>
              ) : (
                <>
                  {updateError && (
                    <Alert variant="destructive">
                      <AlertDescription>{updateError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Ticket Info */}
                  <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedTicket.title}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={priorityConfig[selectedTicket.priority].color}>
                          {priorityConfig[selectedTicket.priority].label}
                        </Badge>
                        <Badge className={statusConfig[selectedTicket.status].color}>
                          {statusConfig[selectedTicket.status].label}
                        </Badge>
                        <Badge variant="outline">
                          {categoryLabels[selectedTicket.category]}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground">
                        <span className="font-medium">Người gửi:</span> {selectedTicket.userName || "N/A"} ({selectedTicket.userEmail || "N/A"})
                      </p>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Thời gian:</span> {formatDate(selectedTicket.createdAt)}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-sm mb-1">Mô tả:</p>
                      <div className="text-sm bg-background rounded p-3 whitespace-pre-wrap">
                        {selectedTicket.description}
                      </div>
                    </div>

                    {selectedTicket.adminNote && (
                      <div>
                        <p className="font-medium text-sm mb-1">Ghi chú admin:</p>
                        <div className="text-sm bg-green-50 dark:bg-green-900/20 rounded p-3 whitespace-pre-wrap">
                          {selectedTicket.adminNote}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Update Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trạng thái</Label>
                        <Select
                          value={newStatus}
                          onValueChange={(v) => setNewStatus(v as TicketStatus)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Mới</SelectItem>
                            <SelectItem value="in_progress">Đang xử lý</SelectItem>
                            <SelectItem value="resolved">Đã giải quyết</SelectItem>
                            <SelectItem value="closed">Đã đóng</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Độ ưu tiên</Label>
                        <Select
                          value={newPriority}
                          onValueChange={(v) => setNewPriority(v as TicketPriority)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Thấp</SelectItem>
                            <SelectItem value="medium">Trung bình</SelectItem>
                            <SelectItem value="high">Cao</SelectItem>
                            <SelectItem value="urgent">Khẩn cấp</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Ghi chú phản hồi</Label>
                      <Textarea
                        placeholder="Nhập ghi chú hoặc phản hồi cho người dùng..."
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={isUpdating}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => setDetailDialogOpen(false)}
                        disabled={isUpdating}
                        className="flex-1 sm:flex-none"
                      >
                        Đóng
                      </Button>
                      <Button onClick={() => void handleUpdateTicket()} disabled={isUpdating} className="flex-1 sm:flex-none">
                        {isUpdating ? "Đang cập nhật..." : "Cập nhật"}
                      </Button>
                    </div>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Xác nhận xóa ticket
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa ticket này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium">{selectedTicket?.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Người gửi: {selectedTicket?.userName || selectedTicket?.userEmail}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteTicket()} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xóa ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-medium">{children}</div>
  );
}
