import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { sendEmail, generatePassword } from "@/lib/email";

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 * Gửi mật khẩu mới qua email cho user
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Email không hợp lệ" },
        { status: 400 }
      );
    }

    // Tìm user trong Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      // Không tìm thấy user - vẫn trả về success để tránh leak thông tin
      return NextResponse.json({
        success: true,
        message: "Nếu email tồn tại, mật khẩu mới sẽ được gửi",
      });
    }

    // Tạo mật khẩu mới
    const newPassword = generatePassword();

    // Cập nhật mật khẩu trong Firebase Auth
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Gửi email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔑 E-Path Training</h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Yêu cầu đặt lại mật khẩu</h2>
    
    <p>Xin chào,</p>
    
    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Mật khẩu mới của bạn:</p>
      <p style="margin: 0; font-size: 20px; font-weight: bold; color: #667eea; font-family: monospace; letter-spacing: 2px;">
        ${newPassword}
      </p>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      <strong>Lưu ý:</strong> Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      Email này được gửi tự động từ E-Path Training System.<br>
      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
    </p>
  </div>
</body>
</html>
`;

    try {
      await sendEmail({
        to: email,
        subject: "🔑 Mật khẩu mới - E-Path Training System",
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("[api/auth/forgot-password] send email error:", emailError);
      // Vẫn trả về success vì password đã được đổi
      // Admin có thể thông báo cho user qua kênh khác
    }

    return NextResponse.json({
      success: true,
      message: "Nếu email tồn tại, mật khẩu mới sẽ được gửi đến hộp thư của bạn.",
    });
  } catch (error) {
    console.error("[api/auth/forgot-password] error:", error);
    return NextResponse.json(
      { success: false, error: "Có lỗi xảy ra" },
      { status: 500 }
    );
  }
}
