"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ticketService } from "@/services/training";
import type { TicketCategory, TicketPriority } from "@/types/training";

interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const categoryLabels: Record<TicketCategory, string> = {
  bug: "Lỗi hệ thống",
  video_issue: "Lỗi video",
  quiz_issue: "Lỗi bài kiểm tra",
  login_issue: "Lỗi đăng nhập",
  content_error: "Nội dung sai",
  suggestion: "Đề xuất cải thiện",
  other: "Khác",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export function TicketDialog({ open, onOpenChange, onSuccess }: TicketDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("bug");
  const [priority, setPriority] = useState<TicketPriority>("medium");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề");
      return;
    }
    if (!description.trim()) {
      setError("Vui lòng nhập mô tả chi tiết");
      return;
    }
    if (description.trim().length < 10) {
      setError("Mô tả phải có ít nhất 10 ký tự");
      return;
    }

    setIsLoading(true);

    try {
      const res = await ticketService.create({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });

      if (res.success) {
        setSuccess(true);
        setTitle("");
        setDescription("");
        setCategory("bug");
        setPriority("medium");
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          onSuccess?.();
        }, 1500);
      } else {
        setError((res as { error?: string }).error || "Không thể tạo ticket");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setError(null);
      setSuccess(false);
      setTitle("");
      setDescription("");
      setCategory("bug");
      setPriority("medium");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🐛</span>
            Báo cáo sự cố
          </DialogTitle>
          <DialogDescription>
            Gửi yêu cầu hỗ trợ khi gặp lỗi hoặc vấn đề về hệ thống
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-lg font-semibold">Gửi thành công!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Yêu cầu của bạn đã được gửi. Bộ phận IT sẽ xử lý trong thời gian sớm nhất.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">
                Danh mục <span className="text-destructive">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TicketCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Mức độ ưu tiên</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TicketPriority)}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Tiêu đề <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Mô tả ngắn gọn vấn đề"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/200
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Mô tả chi tiết <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Mô tả chi tiết vấn đề bạn gặp phải, bao gồm:&#10;- Bước để tái hiện lỗi&#10;- Thông báo lỗi hiển thị (nếu có)&#10;- Thiết bị/trình duyệt đang sử dụng"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/2000
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
