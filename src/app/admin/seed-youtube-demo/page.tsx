"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Database,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  PlayCircle,
} from "lucide-react";
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
import { extractYouTubeId } from "@/lib/youtube";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

interface SeedLesson {
  title: string;
  description: string;
  duration: number;
  youtubeUrl: string;
}

const COURSE_ID = "yt-demo-react-fundamentals";

const SEED_COURSE = {
  id: COURSE_ID,
  title: "React Fundamentals - Xây dựng ứng dụng web hiện đại",
  description:
    "Khóa học React từ cơ bản đến nâng cao. Bạn sẽ học về components, props, state, hooks, context, và xây dựng ứng dụng web hiện đại.",
  thumbnail: "",
  banner: "",
  category: "it" as const,
  level: "beginner" as const,
  tags: ["React", "JavaScript", "Frontend", "Web Development"],
  instructorId: "system-seed",
  status: "published" as const,
  enrolledCount: 0,
  completedCount: 0,
  averageRating: 0,
  totalRatings: 0,
  duration: 0,
  passingScore: 70,
  enrollmentType: "open" as const,
};

const SEED_LESSONS: SeedLesson[] = [
  {
    title: "Giới thiệu về React",
    description: "Tìm hiểu React là gì và tại sao nên sử dụng React",
    duration: 600,
    youtubeUrl: "https://youtu.be/gokUZVjCzow?si=TV4LNn3ATCMZkMNI",
  },
  {
    title: "Cài đặt môi trường & Components",
    description: "Hướng dẫn cài đặt Node.js, tạo dự án React và làm quen components",
    duration: 900,
    youtubeUrl: "https://www.youtube.com/watch?v=Tn6-PIqc4UM",
  },
  {
    title: "State, Props và Hooks cơ bản",
    description: "Quản lý state với useState và useEffect",
    duration: 1200,
    youtubeUrl: "https://youtu.be/O6P86uwfdR0",
  },
];

export default function SeedYoutubeDemoPage() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [courseUrl, setCourseUrl] = useState<string | null>(null);

  const runSeed = async () => {
    if (!user) {
      setError("Bạn cần đăng nhập.");
      return;
    }
    const ok = window.confirm(
      `Tạo course "${SEED_COURSE.title}" với ${SEED_LESSONS.length} bài học YouTube?\n` +
        `Nếu course đã tồn tại sẽ bị ghi đè.`
    );
    if (!ok) return;

    setIsRunning(true);
    setError(null);
    setDone(false);

    try {
      const totalDuration = SEED_LESSONS.reduce(
        (s, l) => s + l.duration,
        0
      );

      await setDoc(doc(db, "courses", COURSE_ID), {
        ...SEED_COURSE,
        duration: totalDuration,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (let i = 0; i < SEED_LESSONS.length; i++) {
        const lesson = SEED_LESSONS[i];
        const lessonRef = await addDoc(
          collection(db, "courses", COURSE_ID, "lessons"),
          {
            title: lesson.title,
            description: lesson.description,
            type: "video",
            order: i + 1,
            duration: lesson.duration,
            isPreview: i === 0,
            content: {
              youtubeId: extractYouTubeId(lesson.youtubeUrl),
              videoDuration: lesson.duration,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
        if (i === 0) {
          setCourseUrl(`/dashboard/courses/${COURSE_ID}/lessons/${lessonRef.id}`);
        }
      }

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <PageContainer
      title="Seed dữ liệu demo YouTube"
      description="Tạo 1 khóa học + 3 bài học nhúng YouTube để kiểm thử"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Seed YouTube demo" },
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Seed khóa học demo
          </CardTitle>
          <CardDescription>
            Document sẽ được lưu trong collection <code>courses</code> với id{" "}
            <code>{COURSE_ID}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <PlayCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cấu trúc lưu trữ (bảo mật):</strong> chỉ lưu{" "}
              <code>youtubeId</code> (11 ký tự) trong{" "}
              <code>content.youtubeId</code>. URL embed được sinh tại client:
              <br />
              <code className="block mt-1 break-all text-xs">
                https://www.youtube-nocookie.com/embed/{"{youtubeId}"}?rel=0&modestbranding=1
              </code>
              <br />
              URL thật (ví dụ <code>?si=ZLwcKX6rbbEKbJeQ</code>) không bao giờ
              xuất hiện trong HTML client.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border p-3">
            <p className="text-sm font-medium mb-2">Sẽ tạo {SEED_LESSONS.length} bài học:</p>
            <ul className="text-sm space-y-1">
              {SEED_LESSONS.map((l, i) => {
                const id = extractYouTubeId(l.youtubeUrl);
                return (
                  <li key={l.youtubeUrl} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span>{l.title}</span>
                    <code className="ml-auto text-xs text-muted-foreground">
                      {id ?? "❌ URL không hợp lệ"}
                    </code>
                  </li>
                );
              })}
            </ul>
          </div>

          {!user && (
            <Alert variant="destructive">
              <AlertDescription>Bạn cần đăng nhập để seed.</AlertDescription>
            </Alert>
          )}

          {user && !isAdmin && (
            <Alert variant="destructive">
              <AlertDescription>
                Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ
                <strong> admin </strong> mới có quyền seed.
              </AlertDescription>
            </Alert>
          )}

          {user && isAdmin && (
            <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Đã đăng nhập với quyền <strong>admin</strong>.
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

          {done && (
            <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Đã seed thành công!</strong>{" "}
                <Link
                  href={`/dashboard/courses/${COURSE_ID}`}
                  className="underline"
                >
                  Mở khóa học →
                </Link>
                {courseUrl && (
                  <>
                    {" "}|{" "}
                    <Link href={courseUrl} className="underline">
                      Mở bài học đầu tiên →
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={runSeed}
            disabled={isRunning || !isAdmin}
            className="w-full sm:w-auto"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Seed ngay
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}