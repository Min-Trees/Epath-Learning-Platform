"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Award,
  User,
  BookOpen,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api-client";

interface EssayAnswer {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  attemptCount: number;
  answers: Record<string, string>;
  createdAt: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  earnedPoints?: Record<string, number>;
  maxPoints?: Record<string, number>;
}

export default function EssayReviewsPage() {
  const [essays, setEssays] = useState<EssayAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEssay, setSelectedEssay] = useState<EssayAnswer | null>(null);
  const [gradingPoints, setGradingPoints] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState(false);

  const loadEssays = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ essays: EssayAnswer[] }>("/api/admin/tests/essay-reviews");
      if (res.success && res.data) {
        setEssays(res.data.essays);
      } else {
        setError((res as { error?: string }).error ?? "Lỗi tải dữ liệu");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEssays();
  }, [loadEssays]);

  const pendingEssays = essays.filter((e) => !e.reviewed);
  const reviewedEssays = essays.filter((e) => e.reviewed);

  const handleSelectEssay = (essay: EssayAnswer) => {
    setSelectedEssay(essay);
    // Initialize grading points with previous values or max points
    const initialPoints: Record<string, string> = {};
    Object.keys(essay.answers).forEach((q) => {
      initialPoints[q] = essay.earnedPoints?.[q]?.toString() ?? "";
    });
    setGradingPoints(initialPoints);
  };

  const handleGrade = async () => {
    if (!selectedEssay) return;

    setIsGrading(true);
    try {
      // Convert string points to numbers
      const earnedPoints: Record<string, number> = {};
      Object.entries(gradingPoints).forEach(([q, p]) => {
        const num = parseInt(p, 10);
        if (!isNaN(num) && num >= 0) {
          earnedPoints[q] = num;
        }
      });

      const res = await apiPost("/api/admin/tests/essay-reviews/grade", {
        essayId: selectedEssay.id,
        earnedPoints,
      });

      if (res.success) {
        await loadEssays();
        setSelectedEssay(null);
        setGradingPoints({});
      } else {
        setError((res as { error?: string }).error ?? "Lỗi khi chấm điểm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGrading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <PageContainer
      title="Chấm điểm tự luận"
      breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Tests", href: "/admin/tests" },
        { label: "Chấm điểm tự luận" },
      ]}
      actions={
        <Button variant="outline" onClick={() => void loadEssays()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: List of essays */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Danh sách câu trả lời
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : essays.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Chưa có câu trả lời tự luận nào</p>
              </div>
            ) : (
              <Tabs defaultValue="pending">
                <TabsList className="w-full">
                  <TabsTrigger value="pending" className="flex-1">
                    Chờ chấm ({pendingEssays.length})
                  </TabsTrigger>
                  <TabsTrigger value="reviewed" className="flex-1">
                    Đã chấm ({reviewedEssays.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4 space-y-3">
                  {pendingEssays.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">
                      Không có câu nào chờ chấm
                    </p>
                  ) : (
                    pendingEssays.map((essay) => (
                      <div
                        key={essay.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEssay?.id === essay.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleSelectEssay(essay)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Chờ chấm
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            #{essay.attemptCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{essay.userName || essay.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <BookOpen className="h-3 w-3" />
                          <span className="truncate">{essay.lessonTitle || essay.lessonId}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(essay.createdAt)}
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">{Object.keys(essay.answers).length}</span> câu
                          hỏi
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="reviewed" className="mt-4 space-y-3">
                  {reviewedEssays.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">
                      Chưa có câu nào được chấm
                    </p>
                  ) : (
                    reviewedEssays.map((essay) => (
                      <div
                        key={essay.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleSelectEssay(essay)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <Badge variant="secondary">Đã chấm</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{essay.userName || essay.userEmail}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <BookOpen className="h-3 w-3" />
                          <span className="truncate">{essay.lessonTitle}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {essay.reviewedAt ? `Đã chấm: ${formatDate(essay.reviewedAt)}` : ""}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Right: Grading panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5" />
              {selectedEssay ? "Chấm điểm" : "Chọn câu trả lời để chấm"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEssay ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Chọn một câu trả lời từ danh sách bên trái</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User info */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedEssay.userName || selectedEssay.userEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{selectedEssay.programTitle}</span>
                    <span>-</span>
                    <span>{selectedEssay.lessonTitle}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lần thử #{selectedEssay.attemptCount} · {formatDate(selectedEssay.createdAt)}
                  </div>
                </div>

                {/* Answers */}
                <div className="space-y-4">
                  {Object.entries(selectedEssay.answers).map(([question, answer], idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="font-medium text-sm">
                        <span className="text-muted-foreground">Câu {idx + 1}:</span> {question}
                      </div>
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                        <p className="text-sm text-muted-foreground mb-2">Câu trả lời của học viên:</p>
                        <p className="text-sm whitespace-pre-wrap">{answer || "(không có câu trả lời)"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">Điểm:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={selectedEssay.maxPoints?.[question] || 100}
                          value={gradingPoints[question] || ""}
                          onChange={(e) =>
                            setGradingPoints((prev) => ({
                              ...prev,
                              [question]: e.target.value,
                            }))
                          }
                          className="w-24"
                          placeholder="0"
                        />
                        <span className="text-sm text-muted-foreground">
                          / {selectedEssay.maxPoints?.[question] || "?"} điểm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedEssay(null);
                      setGradingPoints({});
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={() => void handleGrade()} disabled={isGrading}>
                    {isGrading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Lưu điểm
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
