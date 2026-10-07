"use client";

import type { UserReportSummary, TeamReportSummary } from "@/types/training";

export interface PdfExportOptions {
  currentUserName?: string;
  currentUserRole?: string;
  managerName?: string;
  department?: string;
  isManager?: boolean;
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam (DD/MM/YYYY HH:mm)
 */
function formatVnDateTime(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${min}`;
}

function formatVnDate(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case "admin":
      return "Quản trị viên";
    case "manager":
      return "Quản lý";
    case "hr":
      return "Nhân sự (HR)";
    case "trainer":
      return "Giảng viên";
    case "employee":
      return "Nhân viên";
    default:
      return "Người dùng";
  }
}

/**
 * CSS tối giản, hiện đại, thanh lịch cho bản in PDF chuẩn A4
 * Tối ưu hóa phông chữ Tiếng Việt, đường nét sắc sảo, không rườm rà.
 */
const BASE_PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body, .pdf-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    font-size: 11.5px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }
  .pdf-container {
    width: 800px;
    padding: 30px 34px;
    margin: 0 auto;
    background: #ffffff;
  }
  .header-brand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0284c7;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .brand-title {
    font-size: 14px;
    font-weight: 700;
    color: #0369a1;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .brand-subtitle {
    font-size: 9.5px;
    color: #64748b;
    margin-top: 2px;
  }
  .doc-meta {
    text-align: right;
    font-size: 9.5px;
    color: #64748b;
    line-height: 1.4;
  }
  .report-title-box {
    text-align: center;
    margin: 12px 0 16px 0;
  }
  .report-title {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .report-subtitle {
    font-size: 10.5px;
    color: #64748b;
    margin-top: 3px;
  }
  .info-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 18px;
  }
  .info-row {
    font-size: 11px;
    display: flex;
    align-items: baseline;
  }
  .info-label {
    color: #64748b;
    font-weight: 500;
    width: 105px;
    flex-shrink: 0;
  }
  .info-value {
    color: #0f172a;
    font-weight: 600;
  }
  .program-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    margin-bottom: 14px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .program-header {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .program-title {
    font-weight: 700;
    font-size: 12px;
    color: #0f172a;
  }
  .program-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 10px;
    color: #475569;
  }
  .progress-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .progress-track {
    background: #e2e8f0;
    border-radius: 3px;
    height: 6px;
    width: 65px;
    overflow: hidden;
    display: inline-block;
  }
  .progress-bar {
    height: 100%;
    background: #0284c7;
    border-radius: 3px;
  }
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  .pdf-table th {
    background: #ffffff;
    color: #475569;
    font-weight: 600;
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #cbd5e1;
    font-size: 10px;
    text-transform: uppercase;
  }
  .pdf-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #f1f5f9;
    color: #1e293b;
    vertical-align: middle;
  }
  .pdf-table tr:last-child td {
    border-bottom: none;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
  }
  .badge-success { background: #dcfce7; color: #15803d; }
  .badge-warning { background: #fef3c7; color: #b45309; }
  .badge-secondary { background: #f1f5f9; color: #475569; }
  .badge-danger { background: #fee2e2; color: #b91c1c; }
  .signatures-box {
    margin-top: 24px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    text-align: center;
    page-break-inside: avoid;
  }
  .signatures-box.two-cols {
    grid-template-columns: 1fr 1fr;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
    gap: 40px;
  }
  .sign-title {
    font-weight: 600;
    font-size: 10.5px;
    color: #334155;
    text-transform: uppercase;
  }
  .sign-subtitle {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 1px;
  }
  .sign-space {
    height: 50px;
  }
  .sign-name {
    font-weight: 600;
    font-size: 10.5px;
    color: #0f172a;
    border-top: 1px dashed #cbd5e1;
    padding-top: 4px;
    margin: 0 15px;
  }
  .pdf-footer {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #94a3b8;
  }
`;

/**
 * Sinh HTML cho báo cáo tiến độ chi tiết của một nhân viên
 * - Đơn giản, rõ ràng, tinh tế
 * - Không có các khối thống kê chung cồng kềnh
 * - Tập trung trực tiếp vào tiến độ từng chương trình và bài học của nhân viên
 */
export function generateEmployeeProgressHtml(
  summary: UserReportSummary,
  options?: PdfExportOptions
): string {
  const now = new Date();
  const code = `BC-TD-${(summary.userId || "NV").slice(0, 6).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  // Danh sách chi tiết các chương trình đào tạo của nhân viên
  const programsHtml =
    summary.programs.length === 0
      ? `<div style="padding: 16px; text-align: center; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 11px;">Nhân viên hiện chưa được phân công chương trình đào tạo nào.</div>`
      : summary.programs
          .map((prog, pIdx) => {
            const progBadge =
              prog.status === "completed"
                ? `<span class="badge badge-success">Hoàn thành</span>`
                : prog.status === "in_progress"
                  ? `<span class="badge badge-warning">Đang học</span>`
                  : `<span class="badge badge-secondary">Chưa bắt đầu</span>`;

            const lessonsRows =
              prog.lessons.length === 0
                ? `<tr><td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic; padding: 10px;">Chưa có bài học nào trong chương trình</td></tr>`
                : prog.lessons
                    .map((l, lIdx) => {
                      const testScoreDisplay =
                        typeof l.testScore === "number"
                          ? `<strong style="color: ${l.testPassed ? "#15803d" : "#b91c1c"}">${l.testScore}%</strong>`
                          : `<span style="color: #94a3b8;">--</span>`;

                      const attemptDisplay =
                        typeof l.attemptCount === "number" && l.attemptCount > 0
                          ? `${l.attemptCount} lần`
                          : `<span style="color: #94a3b8;">--</span>`;

                      const testEvalBadge =
                        typeof l.testScore === "number"
                          ? l.testPassed
                            ? `<span class="badge badge-success">Đạt</span>`
                            : `<span class="badge badge-danger">Chưa đạt</span>`
                          : l.lessonStatus === "completed"
                            ? `<span class="badge badge-success">Hoàn thành</span>`
                            : `<span style="color: #94a3b8; font-size: 9px;">--</span>`;

                      return `
                  <tr>
                    <td style="text-align: center; width: 32px; color: #64748b;">${l.order || lIdx + 1}</td>
                    <td style="font-weight: 500;">${l.title || "Bài học " + (lIdx + 1)}</td>
                    <td style="text-align: center; width: 75px;">${testScoreDisplay}</td>
                    <td style="text-align: center; width: 75px;">${attemptDisplay}</td>
                    <td style="text-align: center; width: 90px;">${testEvalBadge}</td>
                  </tr>
                `;
                    })
                    .join("");

            return `
        <div class="program-card">
          <div class="program-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="program-title">${pIdx + 1}. ${prog.programTitle}</span>
              ${progBadge}
            </div>
            <div class="program-meta">
              <span>Tiến độ: <strong style="color: #0284c7; font-size: 11.5px;">${prog.percent}%</strong></span>
            </div>
          </div>
          <table class="pdf-table">
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th>Bài học</th>
                <th style="width: 75px; text-align: center;">Điểm thi</th>
                <th style="width: 75px; text-align: center;">Lần thi</th>
                <th style="width: 90px; text-align: center;">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              ${lessonsRows}
            </tbody>
          </table>
        </div>
      `;
          })
          .join("");

  return `
    <div class="pdf-container">
      <!-- Header thương hiệu -->
      <div class="header-brand">
        <div>
          <div class="brand-title">LittlePeople Training Hub</div>
        </div>
        <div class="doc-meta">
          <div><strong>Mã báo cáo:</strong> ${code}</div>
          <div><strong>Ngày xuất:</strong> ${formatVnDateTime(now)}</div>
          <div><strong>Người xuất:</strong> ${options?.currentUserName || "Hệ thống"} (${getRoleLabel(options?.currentUserRole)})</div>
        </div>
      </div>

      <!-- Tiêu đề báo cáo -->
      <div class="report-title-box">
        <h1 class="report-title">Báo Cáo Tiến Độ Đào Tạo Nhân Viên</h1>
        <p class="report-subtitle">Chi tiết quá trình học tập và kết quả bài kiểm tra năng lực</p>
      </div>

      <!-- Thông tin nhân viên (gọn gàng, rõ ràng) -->
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Họ và tên:</span>
          <span class="info-value">${summary.displayName || "(Chưa cập nhật)"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${summary.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phòng ban:</span>
          <span class="info-value">${summary.department || "(Chưa phân bổ)"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Chức danh:</span>
          <span class="info-value">${summary.position || "Nhân viên"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Quản lý trực tiếp:</span>
          <span class="info-value">${summary.managerName || options?.managerName || "(Chưa chỉ định)"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tổng khóa học:</span>
          <span class="info-value">${summary.totalAssigned} chương trình (${summary.completed} hoàn thành)</span>
        </div>
      </div>

      <!-- Tiến độ từng chương trình đào tạo -->
      <div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.3px;">
        Chi tiết tiến độ học tập các khóa đào tạo:
      </div>
      ${programsHtml}

      <!-- Chữ ký xác nhận -->
      <div class="signatures-box two-cols">
        <div>
          <div class="sign-title">Người lập báo cáo</div>
          <div class="sign-subtitle">(Ký và ghi rõ họ tên)</div>
          <div class="sign-space"></div>
          <div class="sign-name">${options?.currentUserName || "Người lập"}</div>
        </div>
        <div>
          <div class="sign-title">Nhân viên tiếp nhận</div>
          <div class="sign-subtitle">(Ký xác nhận)</div>
          <div class="sign-space"></div>
          <div class="sign-name">${summary.displayName || summary.email}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pdf-footer">
        <div>LittlePeople Training Hub — Tài liệu lưu hành nội bộ</div>
        <div>Ngày xuất: ${formatVnDate(now)}</div>
      </div>
    </div>
  `;
}

/**
 * Sinh HTML cho báo cáo danh sách tiến độ các nhân viên thuộc quyền quản lý
 * - Không có khối thống kê chung cồng kềnh
 * - Hiển thị trực tiếp bảng tiến độ rõ ràng của từng nhân viên
 */
export function generateTeamProgressHtml(
  summary: TeamReportSummary,
  options?: PdfExportOptions
): string {
  const now = new Date();
  const code = `BC-DS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const membersRows =
    summary.members.length === 0
      ? `<tr><td colspan="7" style="text-align: center; color: #64748b; font-style: italic; padding: 16px;">Không có dữ liệu nhân viên thuộc quyền quản lý.</td></tr>`
      : summary.members
          .map((m, idx) => {
            return `
        <tr>
          <td style="text-align: center; width: 30px; color: #64748b;">${idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${m.displayName || "(Chưa đặt tên)"}</div>
            <div style="font-size: 9px; color: #64748b;">${m.email}</div>
          </td>
          <td style="font-size: 10px; color: #475569;">${m.department || "--"}</td>
          <td style="text-align: center; font-weight: 600;">${m.totalAssigned}</td>
          <td style="text-align: center; color: #15803d; font-weight: 600;">${m.completed}</td>
          <td style="text-align: center; color: #b45309; font-weight: 600;">${m.inProgress}</td>
          <td style="text-align: center; font-weight: 700; color: #0284c7; font-size: 11px;">
            ${m.overallPercent}%
          </td>
        </tr>
      `;
          })
          .join("");

  const scopeText = options?.isManager
    ? "Nhân viên thuộc quyền quản lý trực tiếp"
    : "Toàn bộ nhân viên hệ thống";

  return `
    <div class="pdf-container">
      <!-- Header thương hiệu -->
      <div class="header-brand">
        <div>
          <div class="brand-title">LittlePeople Training Hub</div>
        </div>
        <div class="doc-meta">
          <div><strong>Mã báo cáo:</strong> ${code}</div>
          <div><strong>Thời gian xuất:</strong> ${formatVnDateTime(now)}</div>
          <div><strong>Người xuất:</strong> ${options?.currentUserName || "Quản lý"} (${getRoleLabel(options?.currentUserRole)})</div>
        </div>
      </div>

      <!-- Tiêu đề báo cáo -->
      <div class="report-title-box">
        <h1 class="report-title">Báo Cáo Tiến Độ Đào Tạo Nhân Viên</h1>
        <p class="report-subtitle">Phạm vi: <strong>${scopeText}</strong>${options?.department ? ` · Phòng ban: ${options.department}` : ""}</p>
      </div>

      <!-- Thông tin báo cáo -->
      <div class="info-box" style="grid-template-columns: 1fr 1fr;">
        <div class="info-row">
          <span class="info-label">Phạm vi báo cáo:</span>
          <span class="info-value">${scopeText}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tổng nhân sự:</span>
          <span class="info-value">${summary.totalEmployees} nhân viên</span>
        </div>
        <div class="info-row">
          <span class="info-label">Ngày báo cáo:</span>
          <span class="info-value">${formatVnDate(now)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Người lập biểu:</span>
          <span class="info-value">${options?.currentUserName || "Hệ thống"}</span>
        </div>
      </div>

      <!-- Bảng tiến độ chi tiết từng nhân viên -->
      <div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.3px;">
        Tiến độ học tập chi tiết của từng nhân viên:
      </div>
      <table class="pdf-table" style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="width: 32px; text-align: center;">#</th>
            <th>Nhân viên</th>
            <th style="width: 110px;">Phòng ban</th>
            <th style="width: 60px; text-align: center;">Đã gán</th>
            <th style="width: 60px; text-align: center;">Đã xong</th>
            <th style="width: 60px; text-align: center;">Đang học</th>
            <th style="width: 80px; text-align: center;">Tiến độ</th>
          </tr>
        </thead>
        <tbody>
          ${membersRows}
        </tbody>
      </table>

      <!-- Chữ ký xác nhận -->
      <div style="margin-top: 24px; display: flex; justify-content: flex-end; page-break-inside: avoid;">
        <div style="width: 220px; text-align: center;">
          <div class="sign-title">Người lập báo cáo</div>
          <div class="sign-subtitle">(Ký và ghi rõ họ tên)</div>
          <div class="sign-space"></div>
          <div class="sign-name">${options?.currentUserName || "Người lập"}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pdf-footer">
        <div>LittlePeople Training Hub — Báo cáo tiến độ đào tạo nội bộ</div>
        <div>Ngày xuất: ${formatVnDate(now)}</div>
      </div>
    </div>
  `;
}

/**
 * Xuất trực tiếp file .PDF bằng html2canvas + jsPDF
 */
export async function downloadPdfFromHtml(
  htmlContent: string,
  fileName: string
): Promise<void> {
  const container = document.createElement("div");
  container.className = "pdf-export-host";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.background = "#ffffff";
  container.style.zIndex = "-9999";
  container.style.opacity = "1";

  const styleEl = document.createElement("style");
  styleEl.innerHTML = BASE_PDF_STYLES;
  container.appendChild(styleEl);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = htmlContent;
  container.appendChild(wrapper);

  document.body.appendChild(container);

  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 800,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL("image/jpeg", 0.96);

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Mở cửa sổ in / xem trước (Print Preview) chuẩn trình duyệt để lưu PDF hoặc in máy in
 */
export function printHtmlReport(htmlContent: string, title: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép để mở bản in.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${BASE_PDF_STYLES}
        @media screen {
          body {
            background: #f1f5f9;
            padding: 12px 6px;
          }
          .pdf-container {
            max-width: 800px;
            width: 100%;
            margin: 0 auto;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            border-radius: 6px;
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .pdf-container {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
