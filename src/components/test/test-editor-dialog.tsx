"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Circle,
  X,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  ListChecks,
  FileText,
  Award,
} from "lucide-react";
import { testService } from "@/services/training";
import type { QuestionType, TestQuestion } from "@/types/training";
import { cn } from "@/utils";

export interface TestEditorProps {
  programId: string;
  lessonId: string;
  lessonTitle: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

type QuestionDraft =
  | {
      id: string;
      type: "multiple_choice";
      question: string;
      options: string[];
      correctIndex: number;
      point: number;
    }
  | {
      id: string;
      type: "essay";
      question: string;
      sampleAnswer: string;
      point: number;
    };

interface ImportedQuestion {
  question: string;
  type?: QuestionType;
  options?: string[];
  answers?: string[];
  correctAnswer?: string | number;
  correctIndex?: number;
  sampleAnswer?: string;
  point?: number;
}

const generateId = () => `q-${Math.random().toString(36).slice(2, 9)}`;

const createEmptyMultipleChoice = (): QuestionDraft => ({
  id: generateId(),
  type: "multiple_choice",
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  point: 10,
});

const createEmptyEssay = (): QuestionDraft => ({
  id: generateId(),
  type: "essay",
  question: "",
  sampleAnswer: "",
  point: 10,
});

const createEmptyQuestion = (type: QuestionType = "multiple_choice"): QuestionDraft =>
  type === "essay" ? createEmptyEssay() : createEmptyMultipleChoice();

export function TestEditorDialog({
  programId,
  lessonId,
  lessonTitle,
  open,
  onClose,
  onSaved,
}: TestEditorProps) {
  const [questions, setQuestions] = useState<QuestionDraft[]>([createEmptyQuestion()]);
  const [passScore, setPassScore] = useState(70);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState<ImportedQuestion[]>([]);
  const [importFormat, setImportFormat] = useState<"json" | "excel">("json");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing test data
  useEffect(() => {
    if (!open) return;

    const loadTest = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testService.getAdmin(programId, lessonId);
        if (res.success && res.data) {
          const data = res.data as { questions: TestQuestion[]; passScore: number };
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(
              data.questions.map((q) => {
                if (q.type === "essay") {
                  return {
                    id: generateId(),
                    type: "essay" as const,
                    question: q.question,
                    sampleAnswer: q.sampleAnswer || "",
                    point: q.point,
                  };
                }
                return {
                  id: generateId(),
                  type: "multiple_choice" as const,
                  question: q.question,
                  options: [...q.options],
                  correctIndex: q.correctIndex,
                  point: q.point,
                };
              })
            );
          } else {
            setQuestions([createEmptyQuestion()]);
          }
          setPassScore(data.passScore ?? 70);
        } else {
          setQuestions([createEmptyQuestion()]);
          setPassScore(70);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setQuestions([createEmptyQuestion()]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTest();
  }, [open, programId, lessonId]);

  // Update question text
  const updateQuestionText = useCallback((id: string, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, question: value } : q))
    );
  }, []);

  // Update sample answer for essay
  const updateSampleAnswer = useCallback((id: string, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id && q.type === "essay" ? { ...q, sampleAnswer: value } : q))
    );
  }, []);

  // Change question type
  const changeQuestionType = useCallback((id: string, newType: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (newType === "essay") {
          return {
            id: generateId(),
            type: "essay" as const,
            question: q.type === "multiple_choice" ? q.question : "",
            sampleAnswer: "",
            point: q.point,
          };
        }
        return createEmptyMultipleChoice();
      })
    );
  }, []);

  // Update option
  const updateOption = useCallback((qId: string, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId && q.type === "multiple_choice"
          ? { ...q, options: q.options.map((o, i) => (i === optIdx ? value : o)) }
          : q
      )
    );
  }, []);

  // Update correct index
  const updateCorrectIndex = useCallback((qId: string, idx: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId && q.type === "multiple_choice" ? { ...q, correctIndex: idx } : q
      )
    );
  }, []);

  // Update point
  const updatePoint = useCallback((id: string, value: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, point: value } : q))
    );
  }, []);

  const addQuestion = useCallback((q?: QuestionDraft) => {
    setQuestions((prev) => [...prev, q ?? createEmptyQuestion()]);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((q) => q.id !== id);
    });
  }, []);

  const moveQuestion = useCallback((id: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const newQuestions = [...prev];
      [newQuestions[idx], newQuestions[newIdx]] = [newQuestions[newIdx], newQuestions[idx]];
      return newQuestions;
    });
  }, []);

  const addOption = useCallback((qId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId && q.type === "multiple_choice"
          ? { ...q, options: [...q.options, ""] }
          : q
      )
    );
  }, []);

  const removeOption = useCallback((qId: string, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || q.type !== "multiple_choice") return q;
        if (q.options.length <= 2) return q;
        return {
          ...q,
          options: q.options.filter((_, i) => i !== optIdx),
          correctIndex: q.correctIndex >= optIdx ? Math.max(0, q.correctIndex - 1) : q.correctIndex,
        };
      })
    );
  }, []);

  // ─── Import Functions ──────────────────────────────────────
  const parseExcelFile = async (file: File): Promise<ImportedQuestion[]> => {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    
    return jsonData.map((row) => ({
      question: String(row.question || row.Question || row.cau_hoi || row["Câu hỏi"] || ""),
      options: [
        String(row.option1 || row.Option1 || row.option_a || row["Đáp án 1"] || row["A"] || ""),
        String(row.option2 || row.Option2 || row.option_b || row["Đáp án 2"] || row["B"] || ""),
        String(row.option3 || row.Option3 || row.option_c || row["Đáp án 3"] || row["C"] || ""),
        String(row.option4 || row.Option4 || row.option_d || row["Đáp án 4"] || row["D"] || ""),
      ].filter((o) => o.trim()),
      correctAnswer: String(
        row.correctAnswer || row.correct_answer || row["Đáp án đúng"] || 
        row.answer || row.Answer || ""
      ),
      correctIndex: Number(row.correctIndex || row.correct_index || row["Chỉ số đúng"] || 0),
      point: Number(row.point || row.Point || row["Điểm"] || 10),
    }));
  };

  const parseJsonFile = async (file: File): Promise<ImportedQuestion[]> => {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (Array.isArray(data)) {
      return data.map((item) => ({
        question: String(item.question || item.Q || item.cau_hoi || ""),
        options: Array.isArray(item.options) 
          ? item.options.map(String) 
          : Array.isArray(item.answers)
            ? item.answers.map(String)
            : [],
        correctAnswer: item.correctAnswer ?? item.correct_answer ?? item.dap_an ?? item.answer,
        correctIndex: Number(item.correctIndex ?? item.correct_index ?? item.dap_an_index ?? 0),
        point: Number(item.point ?? item.Point ?? item.diem ?? 10),
      }));
    }
    
    if (data.questions && Array.isArray(data.questions)) {
      return parseJsonFile(new File([JSON.stringify(data.questions)], "questions.json"));
    }
    
    throw new Error("Định dạng JSON không hợp lệ");
  };

  const normalizeImportedQuestions = (imported: ImportedQuestion[]): QuestionDraft[] => {
    return imported
      .filter((q) => q.question.trim())
      .map((q) => {
        // Check if this is an essay question (has sampleAnswer or no options)
        if (q.type === "essay" || (!q.options?.length && !q.answers?.length && q.sampleAnswer)) {
          return {
            id: generateId(),
            type: "essay" as const,
            question: q.question.trim(),
            sampleAnswer: q.sampleAnswer || "",
            point: q.point ?? 10,
          };
        }

        // Multiple choice question
        let options = q.options ?? [];
        if (q.answers) {
          options = Array.isArray(q.answers) ? q.answers.map(String) : [String(q.answers)];
        }

        // Handle answer letter to index conversion (A=0, B=1, C=2, D=3)
        let correctIdx = q.correctIndex ?? 0;
        if (typeof q.correctAnswer === "string") {
          const upper = q.correctAnswer.toUpperCase().trim();
          if (upper === "A" || upper === "Đáp án A") correctIdx = 0;
          else if (upper === "B" || upper === "Đáp án B") correctIdx = 1;
          else if (upper === "C" || upper === "Đáp án C") correctIdx = 2;
          else if (upper === "D" || upper === "Đáp án D") correctIdx = 3;
          else if (/^[0-9]+$/.test(upper)) correctIdx = parseInt(upper, 10) - 1;
        }

        // Ensure at least 2 options
        while (options.length < 2) options.push("");

        // Clamp correct index
        correctIdx = Math.max(0, Math.min(correctIdx, options.length - 1));

        return {
          id: generateId(),
          type: "multiple_choice" as const,
          question: q.question.trim(),
          options,
          correctIndex: correctIdx,
          point: q.point ?? 10,
        };
      });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    try {
      let parsed: ImportedQuestion[];
      
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) {
        parsed = await parseExcelFile(file);
      } else if (file.name.endsWith(".json")) {
        parsed = await parseJsonFile(file);
      } else {
        throw new Error("Chỉ hỗ trợ file .json, .xlsx, .xls, .csv");
      }

      if (parsed.length === 0) {
        throw new Error("Không tìm thấy câu hỏi nào trong file");
      }

      setImportData(parsed);
      setShowImportDialog(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Lỗi đọc file");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = () => {
    const normalized = normalizeImportedQuestions(importData);
    if (normalized.length === 0) {
      setImportError("Không có câu hỏi hợp lệ để import");
      return;
    }
    setQuestions(normalized);
    setShowImportDialog(false);
    setImportData([]);
    setImportError(null);
  };

  const handleMergeImport = () => {
    const normalized = normalizeImportedQuestions(importData);
    if (normalized.length === 0) {
      setImportError("Không có câu hỏi hợp lệ để import");
      return;
    }
    setQuestions((prev) => [...prev, ...normalized]);
    setShowImportDialog(false);
    setImportData([]);
    setImportError(null);
  };

  // ─── Export Function ──────────────────────────────────────
  const handleExport = (format: "json" | "csv") => {
    const validQuestions = questions.filter((q) => q.question.trim());

    if (format === "json") {
      const exportData = validQuestions.map((q) => {
        if (q.type === "essay") {
          return {
            type: "essay",
            question: q.question,
            sampleAnswer: q.sampleAnswer,
            point: q.point,
          };
        }
        return {
          type: "multiple_choice",
          question: q.question,
          options: q.options,
          correctAnswer: String.fromCharCode(65 + q.correctIndex),
          correctIndex: q.correctIndex,
          point: q.point,
        };
      });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      downloadBlob(blob, `test-${lessonId}.json`);
    } else {
      const csv = generateCsvContent(validQuestions);
      const blob = new Blob([csv], { type: "text/csv" });
      downloadBlob(blob, `test-${lessonId}.csv`);
    }
  };

  const generateCsvContent = (qs: QuestionDraft[]) => {
    const headers = ["type", "question", "option1", "option2", "option3", "option4", "correctAnswer", "correctIndex", "sampleAnswer", "point"];
    const rows = qs.map((q) => {
      if (q.type === "essay") {
        return [
          `"${q.type}"`,
          `"${q.question.replace(/"/g, '""')}"`,
          `""`,
          `""`,
          `""`,
          `""`,
          `""`,
          `""`,
          `"${q.sampleAnswer.replace(/"/g, '""')}"`,
          q.point,
        ];
      }
      return [
        `"${q.type}"`,
        `"${q.question.replace(/"/g, '""')}"`,
        `"${(q.options[0] || "").replace(/"/g, '""')}"`,
        `"${(q.options[1] || "").replace(/"/g, '""')}"`,
        `"${(q.options[2] || "").replace(/"/g, '""')}"`,
        `"${(q.options[3] || "").replace(/"/g, '""')}"`,
        String.fromCharCode(65 + q.correctIndex),
        q.correctIndex,
        `""`,
        q.point,
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");

    const templateData = [
      { type: "multiple_choice", question: "Ví dụ: Đâu là thủ đô của Việt Nam?", option1: "Hà Nội", option2: "TP. Hồ Chí Minh", option3: "Đà Nẵng", option4: "Hải Phòng", correctAnswer: "A", correctIndex: 0, sampleAnswer: "", point: 10 },
      { type: "multiple_choice", question: "Ví dụ: 2 + 2 = ?", option1: "3", option2: "4", option3: "5", option4: "6", correctAnswer: "B", correctIndex: 1, sampleAnswer: "", point: 10 },
      { type: "essay", question: "Ví dụ: Trình bày khái niệm về AI?", option1: "", option2: "", option3: "", option4: "", correctAnswer: "", correctIndex: "", sampleAnswer: "Trí tuệ nhân tạo (AI) là...", point: 20 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");

    ws["!cols"] = [
      { wch: 15 },
      { wch: 50 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 40 },
      { wch: 10 },
    ];

    XLSX.writeFile(wb, "mau-cau-hoi.xlsx");
  };

  const handleDownloadJsonTemplate = () => {
    const template = [
      {
        question: "Ví dụ: Đâu là thủ đô của Việt Nam?",
        options: ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng"],
        correctAnswer: "A",
        point: 10,
      },
      {
        question: "Ví dụ: 2 + 2 = ?",
        options: ["3", "4", "5", "6"],
        correctAnswer: "B",
        point: 10,
      },
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    downloadBlob(blob, "mau-cau-hoi.json");
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    const validQuestions = questions.filter((q) => q.question.trim());
    if (validQuestions.length === 0) {
      setError("Cần ít nhất 1 câu hỏi có nội dung.");
      return;
    }

    for (const [i, q] of validQuestions.entries()) {
      if (q.type === "essay") {
        // Essay validation - sample answer can be optional
        if (q.point <= 0) {
          setError(`Câu hỏi #${i + 1}: điểm phải lớn hơn 0.`);
          return;
        }
      } else {
        // Multiple choice validation
        const emptyOptions = q.options.filter((o) => !o.trim()).length;
        if (emptyOptions > 0) {
          setError(`Câu hỏi #${i + 1}: đáp án không được để trống.`);
          return;
        }
        if (q.point <= 0) {
          setError(`Câu hỏi #${i + 1}: điểm phải lớn hơn 0.`);
          return;
        }
      }
    }

    if (passScore < 0 || passScore > 100) {
      setError("Điểm đạt phải trong khoảng 0-100%.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Convert draft to TestQuestion format
      const testQuestions: TestQuestion[] = validQuestions.map((q) => {
        if (q.type === "essay") {
          return {
            type: "essay" as const,
            question: q.question.trim(),
            sampleAnswer: q.sampleAnswer.trim(),
            point: q.point,
          };
        }
        return {
          type: "multiple_choice" as const,
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
          point: q.point,
        };
      });

      const res = await testService.upsert(programId, lessonId, {
        questions: testQuestions,
        passScore,
      });

      if (res.success) {
        onClose();
        if (onSaved) {
          await onSaved();
        }
      } else {
        setError((res as { error?: string }).error ?? "Lỗi lưu bài test.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const totalPoints = questions.reduce((sum, q) => sum + q.point, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Bài kiểm tra: {lessonTitle}
            </DialogTitle>
            <DialogDescription>
              Thiết lập câu hỏi trắc nghiệm hoặc tự luận. Người học sẽ không thấy đáp án đúng.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Import/Export Toolbar */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Tổng: {questions.length} câu</span>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{totalPoints} điểm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Template Downloads */}
                    <div className="relative group">
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Download className="h-4 w-4 mr-1" />
                        Tải mẫu
                      </Button>
                      <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10">
                        <div className="bg-background border rounded-md shadow-lg p-1 min-w-[140px]">
                          <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md"
                          >
                            <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
                          </button>
                          <button
                            onClick={handleDownloadJsonTemplate}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md"
                          >
                            <FileJson className="h-4 w-4" /> JSON (.json)
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.xlsx,.xls,.csv"
                      onChange={handleFileImport}
                      className="hidden"
                      id="import-file"
                    />
                    <Button variant="outline" size="sm" asChild>
                      <label htmlFor="import-file" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </label>
                    </Button>
                    <Select value={importFormat} onValueChange={(v) => setImportFormat(v as "json" | "excel")}>
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">
                          <span className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" /> JSON
                          </span>
                        </SelectItem>
                        <SelectItem value="excel">
                          <span className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" /> Excel
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative group">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10">
                        <div className="bg-background border rounded-md shadow-lg p-1 min-w-[120px]">
                          <button
                            onClick={() => handleExport("json")}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md"
                          >
                            <FileJson className="h-4 w-4" /> JSON
                          </button>
                          <button
                            onClick={() => handleExport("csv")}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md"
                          >
                            <FileSpreadsheet className="h-4 w-4" /> CSV/Excel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tải file mẫu để biết định dạng, sau đó điền câu hỏi và import lại.
                </p>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-lg border bg-card p-4 space-y-3 transition-colors",
                      q.type === "essay"
                        ? "border-l-4 border-l-blue-500"
                        : "border-l-4 border-l-purple-500"
                    )}
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 font-mono">
                          #{qIdx + 1}
                        </Badge>
                        <Badge
                          variant={q.type === "essay" ? "info" : "purple"}
                          className="text-xs"
                        >
                          {q.type === "essay" ? (
                            <>
                              <FileText className="h-3 w-3 mr-1" />
                              Tự luận
                            </>
                          ) : (
                            <>
                              <ListChecks className="h-3 w-3 mr-1" />
                              Trắc nghiệm
                            </>
                          )}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          • {q.point} điểm
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={qIdx === 0}
                          onClick={() => moveQuestion(q.id, -1)}
                          title="Di chuyển lên"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={qIdx === questions.length - 1}
                          onClick={() => moveQuestion(q.id, 1)}
                          title="Di chuyển xuống"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {questions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeQuestion(q.id)}
                            title="Xóa câu hỏi"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Question Type & Text */}
                    <div className="space-y-2">
                      <Textarea
                        value={q.question}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                        placeholder={q.type === "essay" ? "Nhập câu hỏi tự luận..." : "Nhập nội dung câu hỏi..."}
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    {/* Multiple Choice Options */}
                    {q.type === "multiple_choice" && (
                      <div className="space-y-2 pl-2 border-l-2 border-purple-200 ml-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          Chọn đáp án đúng bằng cách click vào icon
                        </p>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCorrectIndex(q.id, optIdx)}
                              className="shrink-0 transition-all hover:scale-110"
                              title={q.correctIndex === optIdx ? "Đáp án đúng" : "Đặt làm đáp án đúng"}
                            >
                              {q.correctIndex === optIdx ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 fill-green-100" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                              )}
                            </button>
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                              className={cn(
                                "flex-1 h-9 transition-colors",
                                q.correctIndex === optIdx && "border-green-500 bg-green-50/50"
                              )}
                            />
                            {q.options.length > 2 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeOption(q.id, optIdx)}
                                title="Xóa đáp án"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addOption(q.id)}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Thêm đáp án
                        </Button>
                      </div>
                    )}

                    {/* Essay Sample Answer */}
                    {q.type === "essay" && (
                      <div className="space-y-2 pl-2 border-l-2 border-blue-200 ml-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          <p className="text-xs font-medium text-muted-foreground">
                            Đáp án mẫu (để trống nếu cần chấm hoàn toàn thủ công)
                          </p>
                        </div>
                        <Textarea
                          value={q.sampleAnswer}
                          onChange={(e) => updateSampleAnswer(q.id, e.target.value)}
                          placeholder="Nhập đáp án mẫu để hệ thống tự động so sánh hoặc hỗ trợ admin chấm..."
                          rows={3}
                          className="resize-none bg-blue-50/30 border-blue-200"
                        />
                      </div>
                    )}

                    {/* Point */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Label className="text-sm">Điểm:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={q.point}
                        onChange={(e) =>
                          updatePoint(q.id, Math.max(1, parseInt(e.target.value || "1", 10)))
                        }
                        className="w-20 h-8"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Question Buttons */}
              <div className="rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-primary/5 to-transparent p-5 space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-base font-semibold text-primary">
                    Thêm câu hỏi mới
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => addQuestion(createEmptyMultipleChoice())}
                    className="w-full h-auto py-3 border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50 group"
                    data-testid="add-multiple-choice-btn"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-purple-100 group-hover:bg-purple-500 flex items-center justify-center transition-colors">
                        <ListChecks className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-purple-700 group-hover:text-purple-800">Trắc nghiệm</div>
                        <div className="text-xs text-muted-foreground font-normal">Chấm tự động</div>
                      </div>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => addQuestion(createEmptyEssay())}
                    className="w-full h-auto py-3 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 group"
                    data-testid="add-essay-btn"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-100 group-hover:bg-blue-500 flex items-center justify-center transition-colors">
                        <FileText className="h-5 w-5 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-blue-700 group-hover:text-blue-800">Tự luận</div>
                        <div className="text-xs text-muted-foreground font-normal">Admin chấm thủ công</div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Pass Score Setting */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Cài đặt bài kiểm tra
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Tổng điểm: <span className="font-semibold text-foreground">{totalPoints}</span> điểm
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Điểm đạt (%):</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={passScore}
                      onChange={(e) =>
                        setPassScore(Math.min(100, Math.max(0, parseInt(e.target.value || "0", 10))))
                      }
                      className="w-20 h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Lưu bài test
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(o) => !o && setShowImportDialog(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Xem trước câu hỏi import
            </DialogTitle>
            <DialogDescription>
              Đã tìm thấy {importData.length} câu hỏi. Xác nhận để thêm vào bài test.
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <Alert variant="destructive">
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {normalizeImportedQuestions(importData).map((q, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Câu {idx + 1}</Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant={q.type === "essay" ? "default" : "secondary"} className="text-xs">
                      {q.type === "essay" ? "Tự luận" : "Trắc nghiệm"}
                    </Badge>
                    <Badge variant="secondary">{q.point} điểm</Badge>
                  </div>
                </div>
                <p className="font-medium text-sm">{q.question || "(trống)"}</p>
                {q.type === "essay" ? (
                  <div className="rounded bg-muted/50 p-2 text-xs">
                    <p className="text-muted-foreground mb-1">Đáp án mẫu:</p>
                    <p className="whitespace-pre-wrap">{q.sampleAnswer || "(chưa có)"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-1 p-1 rounded ${optIdx === q.correctIndex ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-muted"}`}
                      >
                        <span className="font-medium">{String.fromCharCode(65 + optIdx)}.</span>
                        <span className="truncate">{opt || "(trống)"}</span>
                        {optIdx === q.correctIndex && <Check className="h-3 w-3 ml-auto shrink-0" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Import sẽ thêm {normalizeImportedQuestions(importData).length} câu hỏi mới. Câu hỏi trùng lặp cần được xóa thủ công.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Hủy
            </Button>
            <Button variant="secondary" onClick={handleMergeImport}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm vào (Merge)
            </Button>
            <Button onClick={handleConfirmImport}>
              <Check className="h-4 w-4 mr-2" />
              Thay thế tất cả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
