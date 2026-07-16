"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <PageContainer>
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Cài đặt</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Các cài đặt tài khoản sẽ được cập nhật trong tương lai.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
