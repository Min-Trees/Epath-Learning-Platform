"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SetupResponse {
  success: boolean;
  data?: { uid: string; email: string; role: string };
  error?: string;
}

export default function SetupAdminPage() {
  const [mode, setMode] = useState<"create" | "promote">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Kiểm tra đã có admin chưa (gọi API server-side để bypass rules)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/setup-admin");
        const json = (await res.json()) as { success: boolean; data?: { hasAdmin: boolean } };
        setHasAdmin(json.data?.hasAdmin ?? false);
      } catch (e) {
        console.error(e);
        setHasAdmin(false);
      }
    })();
  }, []);

  const handleCreate = async () => {
    if (!email || !password) {
      setMessage({ type: "err", text: "Nhập email và mật khẩu." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "err", text: "Mậu khẩu tối thiểu 6 ký tự." });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/setup-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "create", email, password, displayName }),
      });
      const json = (await res.json()) as SetupResponse;
      if (!res.ok || !json.success) {
        setMessage({ type: "err", text: json.error ?? `HTTP ${res.status}` });
        return;
      }
      setMessage({
        type: "ok",
        text: `Tạo admin thành công: ${json.data?.email}. Bạn có thể đăng nhập tại /login.`,
      });
      setHasAdmin(true);
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!email) {
      setMessage({ type: "err", text: "Nhập email của user đã tồn tại." });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/setup-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "promote", email }),
      });
      const json = (await res.json()) as SetupResponse;
      if (!res.ok || !json.success) {
        setMessage({ type: "err", text: json.error ?? `HTTP ${res.status}` });
        return;
      }
      setMessage({
        type: "ok",
        text: `Đã nâng cấp ${json.data?.email} thành admin.`,
      });
      setHasAdmin(true);
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (hasAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Đang kiểm tra…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Setup Admin</CardTitle>
          <CardDescription>
            {hasAdmin
              ? "Hệ thống đã có admin. Trang này không còn tác dụng."
              : "Tạo tài khoản admin đầu tiên cho hệ thống."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasAdmin ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Đã có admin trong hệ thống.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Đăng nhập tại <code>/login</code> bằng tài khoản admin của bạn.
                Để nâng cấp user khác, vào Firestore Console và sửa{" "}
                <code>users/&#123;uid&#125;.role = &quot;admin&quot;</code>.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "create" ? "default" : "outline"}
                  onClick={() => setMode("create")}
                >
                  Tạo admin mới
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "promote" ? "default" : "outline"}
                  onClick={() => setMode("promote")}
                >
                  Nâng cấp user đã có
                </Button>
              </div>

              {mode === "promote" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Dùng tùy chọn này nếu bạn đã tạo tài khoản qua form đăng ký
                  hoặc tạo thủ công trong Firebase Auth.
                </p>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>

              {mode === "create" && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Mậu khẩu</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="≥ 6 ký tự"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Tên hiển thị</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Admin"
                    />
                  </div>
                </>
              )}

              {message && (
                <div
                  className={`rounded-md p-2 text-xs ${
                    message.type === "ok"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <Button
                onClick={mode === "create" ? handleCreate : handlePromote}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading
                  ? "Đang xử lý…"
                  : mode === "create"
                  ? "Tạo admin"
                  : "Nâng cấp thành admin"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Trang này có thể truy cập mà không cần đăng nhập. Sau khi đã có
                admin, nên xóa route <code>/api/admin/setup-admin</code> và{" "}
                <code>/setup-admin</code> khỏi codebase.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}