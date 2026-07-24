"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Plus, 
  Loader2, 
  BookOpen, 
  Calendar,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { programService } from "@/services/training";

type Step = 1 | 2;

interface ProgramForm {
  title: string;
  description: string;
  duration: string;
  startDate: string;
  endDate: string;
}

export default function NewProgramPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramForm>({
    title: "",
    description: "",
    duration: "",
    startDate: "",
    endDate: "",
  });

  const updateForm = (field: keyof ProgramForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const canProceedStep1 = form.title.trim().length > 0;

  const handleCreate = async () => {
    if (!canProceedStep1) return;
    
    setIsSaving(true);
    setError(null);
    try {
      const res = await programService.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
      });
      if (res.success && res.data) {
        const programId = (res.data as { programId: string }).programId;
        router.push(`/admin/programs/${programId}`);
      } else {
        setError((res as { error?: string }).error ?? "Lỗi tạo chương trình");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const STEPS = [
    { num: 1, title: "Thông tin cơ bản", icon: BookOpen, required: canProceedStep1 },
    { num: 2, title: "Xác nhận", icon: CheckCircle2, required: true },
  ];

  return (
    <PageContainer
      title="Tạo chương trình đào tạo mới"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Chương trình", href: "/admin/programs" },
        { label: "Tạo mới" },
      ]}
    >
      <div className="max-w-4xl mx-auto">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div className="flex items-center">
                  <div className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all
                    ${step >= s.num 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-muted bg-muted/50 text-muted-foreground"}
                  `}>
                    {step > s.num ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <s.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={`text-sm font-medium ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.title}
                    </p>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`
                    mx-4 h-px w-12 sm:w-24 flex-1 transition-all
                    ${step > s.num ? "bg-primary" : "bg-muted"}
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              <code className="text-xs">{error}</code>
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Thông tin cơ bản */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle>Thông tin cơ bản</CardTitle>
              </div>
              <CardDescription>
                Nhập thông tin cơ bản về chương trình đào tạo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Tên chương trình <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="VD: An toàn lao động cho nhân viên mới"
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Tên ngắn gọn, dễ nhớ. Sẽ hiển thị cho nhân viên.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Mô tả ngắn về nội dung và mục đích của chương trình..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Thời lượng</Label>
                <Input
                  id="duration"
                  value={form.duration}
                  onChange={(e) => updateForm("duration", e.target.value)}
                  placeholder="VD: 2 giờ, 3 ngày, 1 tuần"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Ngày bắt đầu</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => updateForm("startDate", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Ngày kết thúc</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(e) => updateForm("endDate", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Xác nhận */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle>Xác nhận thông tin</CardTitle>
              </div>
              <CardDescription>
                Kiểm tra lại thông tin trước khi tạo chương trình
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {form.title || "Chưa có tiêu đề"}
                  </h3>
                  {form.description && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {form.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {form.startDate && form.endDate 
                        ? `${form.startDate} - ${form.endDate}`
                        : form.startDate 
                          ? `Bắt đầu: ${form.startDate}`
                          : form.endDate 
                            ? `Kết thúc: ${form.endDate}`
                            : "Chưa đặt ngày"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>Thời lượng: {form.duration || "Chưa xác định"}</span>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  Chương trình sẽ được tạo ở trạng thái <strong>Bản nháp</strong> 
                  và chờ <strong>Admin duyệt</strong> trước khi nhân viên có thể thấy.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between">
          <Button
            variant="outline"
            asChild={step === 1}
            onClick={step === 1 ? undefined : () => setStep(prev => (prev - 1) as Step)}
            disabled={step === 1}
          >
            {step === 1 ? (
              <Link href="/admin/programs">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại
              </Link>
            ) : (
              <>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại
              </>
            )}
          </Button>

          <div className="flex gap-2">
            {step < 2 ? (
              <Button
                onClick={() => setStep((prev: number) => (prev + 1) as Step)}
                disabled={!canProceedStep1}
              >
                Tiếp theo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo chương trình
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
