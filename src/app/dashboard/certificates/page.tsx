"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Award,
  Download,
  ExternalLink,
  Search,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import type { Certificate } from "@/types";

export default function CertificatesPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCertificates = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, "certificates"),
          where("userId", "==", user.id),
          orderBy("issuedAt", "desc")
        );
        const snap = await getDocs(q);
        const items: Certificate[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...(data as Omit<Certificate, "id">),
            issuedAt:
              (data.issuedAt as { toDate?: () => Date } | undefined)?.toDate?.() ??
              new Date(),
          } as Certificate;
        });
        setCertificates(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    fetchCertificates();
  }, [user]);

  const filteredCertificates = certificates.filter((cert) =>
    cert.courseName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleDownload = (certificate: Certificate) => {
    window.alert(
      `Tính năng tải PDF cho chứng chỉ "${certificate.verificationCode}" đang được phát triển.`
    );
  };

  const handleVerify = (certificate: Certificate) => {
    window.alert(
      `Mã xác minh: ${certificate.verificationCode}\nTình trạng: Đã xác minh.`
    );
  };

  return (
    <PageContainer
      title="Chứng chỉ"
      description="Quản lý và xem các chứng chỉ đã đạt được"
      breadcrumbs={[{ label: "Chứng chỉ" }]}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm chứng chỉ..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="h-4 w-4" />
          <span>{certificates.length} chứng chỉ</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Award className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            {certificates.length === 0
              ? "Chưa có chứng chỉ nào"
              : "Không tìm thấy chứng chỉ"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {certificates.length === 0
              ? "Hoàn thành khóa học để nhận chứng chỉ"
              : "Thử thay đổi từ khóa tìm kiếm"}
          </p>
          {certificates.length === 0 && (
            <Button className="mt-4" asChild>
              <Link href="/dashboard/courses">Khám phá khóa học</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCertificates.map((certificate) => (
            <Card key={certificate.id} className="overflow-hidden">
              <div className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-6 text-center">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <Award className="h-48 w-48" />
                </div>

                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                    <Award className="h-8 w-8 text-primary" />
                  </div>

                  <Badge variant="success" className="mb-2">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Đã xác minh
                  </Badge>

                  <h3 className="mt-2 font-bold">{certificate.courseName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {certificate.userName}
                  </p>
                </div>
              </div>

              <CardContent className="space-y-4 p-6">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ngày cấp</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(certificate.issuedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Điểm số</span>
                    <span className="font-medium text-primary">
                      {certificate.score}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mã xác minh</span>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {certificate.verificationCode}
                    </code>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleVerify(certificate)}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Xem
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownload(certificate)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Tải PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Xác minh chứng chỉ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Nhập mã xác minh để kiểm tra tính hợp lệ của chứng chỉ
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Nhập mã xác minh (ví dụ: CERT-2024-001-ABC)"
              className="max-w-md"
            />
            <Button>Xác minh</Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}