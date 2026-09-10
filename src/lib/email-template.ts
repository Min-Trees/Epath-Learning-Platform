/**
 * Shared email templates. Tách ra để dùng chung giữa:
 * - POST /api/admin/users (auto-send khi tạo user mới)
 * - POST /api/admin/users/send-welcome (gửi lại thủ công)
 */

export const APP_NAME = "LittlePeople Training Hub";

export const APP_LOGIN_URL =
  (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "https://lptraininghub.lp-intranet.id.vn") + "/login";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface WelcomeEmailParams {
  displayName: string;
  email: string;
  password: string;
  programTitles: string[];
}

export function buildWelcomeEmail(opts: WelcomeEmailParams): string {
  const { displayName, email, password, programTitles } = opts;
  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(email);
  const loginUrl = APP_LOGIN_URL;

  const programsHtml =
    programTitles.length > 0
      ? `<p style="margin: 14px 0 6px 0; color: #333; font-size: 15px;"><strong>📚 Chương trình đào tạo được gán:</strong></p>
         <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 15px;">
           ${programTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
         </ul>`
      : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chào mừng đến với ${APP_NAME}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f7f7f9;">
  <div style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">🎓 Chào mừng ${safeName} đến với ${APP_NAME}</h1>
    </div>
    <div style="padding: 28px;">
      <h2 style="color: #333; margin-top: 0; font-size: 20px;">Chào mừng bạn đến với hệ thống đào tạo</h2>
      <p style="font-size: 15px;">Xin chào <strong>${safeName}</strong> 👋</p>
      <p style="font-size: 15px;">Chúng tôi rất vui được thông báo rằng bạn đã được tạo tài khoản trên <strong>${APP_NAME}</strong> – Hệ thống đào tạo nội bộ của LittlePeople.</p>
      <p style="font-size: 15px;">Dưới đây là thông tin đăng nhập của bạn:</p>

      <div style="background: #f8f9fa; padding: 18px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 6px 0; font-size: 15px;">🔗 <strong>Link đăng nhập:</strong> <a href="${loginUrl}" style="color: #667eea; word-break: break-all;">${loginUrl}</a></p>
        <p style="margin: 6px 0; font-size: 15px;">📧 <strong>Email:</strong> <span style="font-family: monospace;">${safeEmail}</span></p>
        <p style="margin: 6px 0; font-size: 15px;">🔑 <strong>Mật khẩu:</strong> <span style="font-family: monospace; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #e0e0e0;">${escapeHtml(password)}</span></p>
      </div>

      ${programsHtml}

      <div style="background: #fff7e6; border-left: 4px solid #faad14; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #874d00; font-size: 14px;"><strong>⚠️ Lưu ý quan trọng:</strong> Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này để bảo mật tài khoản của bạn.</p>
      </div>

      <p style="font-size: 14px; color: #555;">Nếu bạn gặp bất kỳ vấn đề gì khi đăng nhập, vui lòng liên hệ bộ phận IT để được hỗ trợ.</p>
      <p style="font-size: 14px; color: #555;">Chúc bạn có những trải nghiệm học tập thú vị và bổ ích!</p>

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0 16px 0;">
      <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
        Email này được gửi tự động từ ${APP_NAME}.<br>
        Vui lòng không trả lời trực tiếp email này.
      </p>
    </div>
  </div>
</body>
</html>`;
}
