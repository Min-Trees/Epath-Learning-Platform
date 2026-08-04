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
} from "lucide-react";
import { testService } from "@/services/training";

export interface TestQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  point: number;
}

export interface TestEditorProps {
  programId: string;
  lessonId: string;
  lessonTitle: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

interface QuestionDraft {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  point: number;
}

interface ImportedQuestion {
  question: string;
  options?: string[];
  answers?: string[];
  correctAnswer?: string | number;
  correctIndex?: number;
  point?: number;
}

const generateId = () => `q-${Math.random().toString(36).slice(2, 9)}`;

const createEmptyQuestion = (): QuestionDraft => ({
  id: generateId(),
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  point: 10,
});

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
              data.questions.map((q) => ({
                id: generateId(),
                question: q.question,
                options: [...q.options],
                correctIndex: q.correctIndex,
                point: q.point,
              }))
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

  const updateQuestion = useCallback((id: string, field: keyof QuestionDraft, value: string | number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  }, []);

  const updateOption = useCallback((qId: string, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o, i) => (i === optIdx ? value : o)) }
          : q
      )
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
        q.id === qId ? { ...q, options: [...q.options, ""] } : q
      )
    );
  }, []);

  const removeOption = useCallback((qId: string, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
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
      const exportData = validQuestions.map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswer: String.fromCharCode(65 + q.correctIndex),
        correctIndex: q.correctIndex,
        point: q.point,
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      downloadBlob(blob, `test-${lessonId}.json`);
    } else {
      const csv = generateCsvContent(validQuestions);
      const blob = new Blob([csv], { type: "text/csv" });
      downloadBlob(blob, `test-${lessonId}.csv`);
    }
  };

  const generateCsvContent = (qs: QuestionDraft[]) => {
    const headers = ["question", "option1", "option2", "option3", "option4", "correctAnswer", "correctIndex", "point"];
    const rows = qs.map((q) => [
      `"${q.question.replace(/"/g, '""')}"`,
      `"${(q.options[0] || "").replace(/"/g, '""')}"`,
      `"${(q.options[1] || "").replace(/"/g, '""')}"`,
      `"${(q.options[2] || "").replace(/"/g, '""')}"`,
      `"${(q.options[3] || "").replace(/"/g, '""')}"`,
      String.fromCharCode(65 + q.correctIndex),
      q.correctIndex,
      q.point,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import("xlsx");
    
    const templateData = [
      { question: "Ví dụ: Đâu là thủ đô của Việt Nam?", option1: "Hà Nội", option2: "TP. Hồ Chí Minh", option3: "Đà Nẵng", option4: "Hải Phòng", correctAnswer: "A", correctIndex: 0, point: 10 },
      { question: "Ví dụ: 2 + 2 = ?", option1: "3", option2: "4", option3: "5", option4: "6", correctAnswer: "B", correctIndex: 1, point: 10 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");
    
    ws["!cols"] = [
      { wch: 50 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
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

    if (passScore < 0 || passScore > 100) {
      setError("Điểm đạt phải trong khoảng 0-100%.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await testService.upsert(programId, lessonId, {
        questions: validQuestions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
          point: q.point,
        })),
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
              Thiết lập câu hỏi trắc nghiệm. Người học sẽ không thấy đáp án đúng.
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
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          #{qIdx + 1}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">
                          {q.point} điểm
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
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeQuestion(q.id)}
                            title="Xóa câu hỏi"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Question Text */}
                    <div>
                      <Textarea
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                        placeholder="Nhập nội dung câu hỏi..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-2 pl-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Chọn đáp án đúng bằng cách click vào icon
                      </p>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuestion(q.id, "correctIndex", optIdx)}
                            className="shrink-0 transition-colors hover:scale-110"
                            title={q.correctIndex === optIdx ? "Đáp án đúng" : "Đặt làm đáp án đúng"}
                          >
                            {q.correctIndex === optIdx ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            )}
                          </button>
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                            className="flex-1 h-9"
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

                    {/* Point */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Label className="text-sm">Điểm:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={q.point}
                        onChange={(e) =>
                          updateQuestion(q.id, "point", Math.max(1, parseInt(e.target.value || "1", 10)))
                        }
                        className="w-20 h-8"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Question Button */}
              <Button variant="outline" onClick={() => addQuestion()} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Thêm câu hỏi
              </Button>

              {/* Pass Score Setting */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">Cài đặt bài kiểm tra</h4>
                    <p className="text-xs text-muted-foreground">
                      Tổng điểm: {totalPoints} điểm
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
                  <Badge variant="secondary">{q.point} điểm</Badge>
                </div>
                <p className="font-medium text-sm">{q.question || "(trống)"}</p>
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
