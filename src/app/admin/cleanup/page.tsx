"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  updateDoc,
} from "firebase/firestore";

const SUBCOLLECTIONS = ["lessons", "documents", "quizzes"];
const COLLECTIONS_TO_DELETE = ["certificates", "progress", "quizAttempts"];

export default function AdminCleanupPage() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const runCleanup = async () => {
    if (!user) {
      setError("Bạn cần đăng nhập");
      return;
    }
    const ok = window.confirm(
      "XÁC NHẬN XÓA\n\n" +
        "Hành động này sẽ XÓA VĨNH VIỄN:\n" +
        "  • Tất cả khóa học\n" +
        "  • Tất cả bài học, tài liệu, quiz\n" +
        "  • Tất cả chứng chỉ\n" +
        "  • Tất cả progress & quiz attempts\n\n" +
        "Không thể khôi phục. Bạn có chắc chắn?"
    );
    if (!ok) return;

    setIsRunning(true);
    setError(null);
    setDone(false);
    setReport(null);

    const out: Record<string, number> = {};
    try {
      const coursesSnap = await getDocs(collection(db, "courses"));
      for (const course of coursesSnap.docs) {
        for (const sub of SUBCOLLECTIONS) {
          const subSnap = await getDocs(
            collection(db, "courses", course.id, sub)
          );
          if (!subSnap.empty) {
            const batch = writeBatch(db);
            subSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            out[`courses/{id}/${sub}`] =
              (out[`courses/{id}/${sub}`] || 0) + subSnap.size;
          }
        }
      }
      out["courses"] = coursesSnap.size;
      if (!coursesSnap.empty) {
        const batch = writeBatch(db);
        coursesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      for (const col of COLLECTIONS_TO_DELETE) {
        const snap = await getDocs(collection(db, col));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        out[col] = snap.size;
      }

      const usersSnap = await getDocs(collection(db, "users"));
      let resetCount = 0;
      for (const u of usersSnap.docs) {
        const data = u.data();
        if (data.enrolledCourses?.length || data.completedCourses?.length) {
          await updateDoc(doc(db, "users", u.id), {
            enrolledCourses: [],
            completedCourses: [],
            updatedAt: new Date().toISOString(),
          });
          resetCount++;
        }
      }
      out["users_reset"] = resetCount;

      setReport(out);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <PageContainer
      title="Dọn dẹp dữ liệu"
      description="Xóa khóa học, bài học, tài liệu, quiz và chứng chỉ"
      breadcrumbs={[{ label: "Quản trị", href: "/admin" }, { label: "Cleanup" }]}
    >
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Vùng nguy hiểm
          </CardTitle>
          <CardDescription>
            Hành động dưới đây không thể hoàn tác. Hãy chắc chắn bạn đã backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Sẽ xóa: <strong>courses</strong>, <strong>certificates</strong>,{" "}
              <strong>progress</strong>, <strong>quizAttempts</strong> và reset
              enrolledCourses/completedCourses trên users.
              <br />
              Giữ nguyên: <strong>users</strong>, <strong>notifications</strong>,{" "}
              <strong>ai_knowledge</strong>.
            </AlertDescription>
          </Alert>

          {!user && (
            <Alert variant="destructive">
              <AlertDescription>
                Bạn cần đăng nhập để chạy cleanup.
              </AlertDescription>
            </Alert>
          )}

          {user && !isAdmin && (
            <Alert variant="destructive">
              <AlertDescription>
                Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ
                role <strong>admin</strong> mới có quyền chạy. Hãy đăng nhập
                bằng tài khoản admin.
              </AlertDescription>
            </Alert>
          )}

          {user && isAdmin && (
            <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Đã đăng nhập với quyền <strong>admin</strong>. Bạn có thể chạy
                cleanup.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                Lỗi: <code className="text-xs">{error}</code>
              </AlertDescription>
            </Alert>
          )}

          {done && report && (
            <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Đã xóa thành công!</strong>
                <ul className="mt-2 list-disc pl-5">
                  {Object.entries(report).map(([k, v]) => (
                    <li key={k}>
                      {k}: <strong>{v}</strong>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button
            variant="destructive"
            onClick={runCleanup}
            disabled={isRunning || !isAdmin}
            className="w-full sm:w-auto"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa tất cả khóa học & chứng chỉ
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}