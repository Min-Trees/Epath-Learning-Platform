"use client";

import { Bell } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotificationsPage() {
  return (
    <PageContainer>
      <div className="flex items-center gap-2 mb-6">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Thông báo</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Chưa có thông báo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Các thông báo mới sẽ xuất hiện ở đây.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
