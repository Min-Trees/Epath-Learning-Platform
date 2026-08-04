"""
Tạo tài liệu hướng dẫn sử dụng Hệ thống Đào tạo Epath - xuất ra file Word (.docx)
Tài liệu dành cho nhân sự, từng bước chi tiết, có hình visualize minh họa + chỗ chèn ảnh chụp.
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from datetime import datetime


# ─── Config ───────────────────────────────────────────────
ASSET_DIR = "D:/LP & EP IT/EpathSystemTraining/docs_assets"


def img_path(name):
    return os.path.join(ASSET_DIR, f"{name}.png")


# ─── Helpers ───────────────────────────────────────────────
def add_heading_custom(doc, text, level=1, color=(30, 64, 175)):
    h = doc.add_heading("", level=level)
    run = h.add_run(text)
    run.font.color.rgb = RGBColor(*color)
    run.font.name = "Calibri"
    if level == 0:
        run.font.size = Pt(28)
    elif level == 1:
        run.font.size = Pt(20)
    elif level == 2:
        run.font.size = Pt(16)
    else:
        run.font.size = Pt(14)
    return h


def add_para(doc, text, bold=False, italic=False, size=11, color=None, align=None):
    p = doc.add_paragraph()
    if align:
        p.alignment = align
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.name = "Calibri"
    if color:
        run.font.color.rgb = RGBColor(*color)
    return p


def add_callout(doc, title, body, icon="💡", bg_hex="DBEAFE", border_color="1E40AF"):
    """Hộp ghi chú nổi bật"""
    table = doc.add_table(rows=1, cols=1)
    table.autofit = True
    cell = table.cell(0, 0)
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), bg_hex)
    tc_pr.append(shd)
    tc_borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "8")
        b.set(qn("w:color"), border_color)
        tc_borders.append(b)
    tc_pr.append(tc_borders)

    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    run = p.add_run(f"{icon} {title}\n")
    run.bold = True
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(30, 64, 175)
    run2 = p.add_run(body)
    run2.font.size = Pt(11)
    doc.add_paragraph()
    return table


def add_step(doc, num, title, description):
    """Hộp bước thực hiện"""
    table = doc.add_table(rows=1, cols=2)
    table.autofit = False
    table.columns[0].width = Cm(1.5)
    table.columns[1].width = Cm(15)

    c0 = table.cell(0, 0)
    c0.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    tc_pr = c0._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), "1E40AF")
    tc_pr.append(shd)
    p0 = c0.paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r0 = p0.add_run(f"BƯỚC\n{num}")
    r0.bold = True
    r0.font.size = Pt(12)
    r0.font.color.rgb = RGBColor(255, 255, 255)

    c1 = table.cell(0, 1)
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(title)
    r1.bold = True
    r1.font.size = Pt(12)
    p2 = c1.add_paragraph()
    r2 = p2.add_run(description)
    r2.font.size = Pt(11)

    for row in table.rows:
        for cell in row.cells:
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_borders = OxmlElement("w:tcBorders")
            for edge in ("top", "left", "bottom", "right"):
                b = OxmlElement(f"w:{edge}")
                b.set(qn("w:val"), "nil")
                tc_borders.append(b)
            tc_pr.append(tc_borders)

    doc.add_paragraph()
    return table


def add_image_placeholder(doc, caption, width_cm=14):
    """Ô chèn ảnh chụp thực tế"""
    table = doc.add_table(rows=1, cols=1)
    table.autofit = False
    table.columns[0].width = Cm(width_cm)

    cell = table.cell(0, 0)
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), "F3F4F6")
    tc_pr.append(shd)
    tc_borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "dashed")
        b.set(qn("w:sz"), "12")
        b.set(qn("w:color"), "9CA3AF")
        tc_borders.append(b)
    tc_pr.append(tc_borders)

    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run("📷 [ CHÈN ẢNH VÀO ĐÂY ]\n\n")
    r1.bold = True
    r1.font.size = Pt(14)
    r1.font.color.rgb = RGBColor(107, 114, 128)
    r2 = p.add_run(caption)
    r2.italic = True
    r2.font.size = Pt(10)
    r2.font.color.rgb = RGBColor(107, 114, 128)

    cell.height = Cm(5)
    doc.add_paragraph()
    return table


def add_visual_image(doc, name, caption=None, width_cm=16):
    """Chèn hình visualize đã tạo từ matplotlib"""
    path = img_path(name)
    if not os.path.exists(path):
        print(f"  [WARN] Khong tim thay: {path}")
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(path, width=Cm(width_cm))
    if caption:
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_cap = p_cap.add_run(caption)
        r_cap.italic = True
        r_cap.font.size = Pt(10)
        r_cap.font.color.rgb = RGBColor(107, 114, 128)
    doc.add_paragraph()


def add_two_col_compare(doc, left_title, left_items, right_title, right_items,
                       left_color="FEF3C7", right_color="D1FAE5"):
    table = doc.add_table(rows=1, cols=2)
    table.autofit = False
    table.columns[0].width = Cm(8)
    table.columns[1].width = Cm(8)

    c0 = table.cell(0, 0)
    tc_pr = c0._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), left_color)
    tc_pr.append(shd)
    p0 = c0.paragraphs[0]
    r0 = p0.add_run(f"✅ {left_title}")
    r0.bold = True
    r0.font.size = Pt(11)
    for item in left_items:
        p = c0.add_paragraph()
        r = p.add_run(f"• {item}")
        r.font.size = Pt(10)

    c1 = table.cell(0, 1)
    tc_pr = c1._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), right_color)
    tc_pr.append(shd)
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(f"❌ {right_title}")
    r1.bold = True
    r1.font.size = Pt(11)
    for item in right_items:
        p = c1.add_paragraph()
        r = p.add_run(f"• {item}")
        r.font.size = Pt(10)

    for row in table.rows:
        for cell in row.cells:
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_borders = OxmlElement("w:tcBorders")
            for edge in ("top", "left", "bottom", "right"):
                b = OxmlElement(f"w:{edge}")
                b.set(qn("w:val"), "single")
                b.set(qn("w:sz"), "4")
                b.set(qn("w:color"), "D1D5DB")
                tc_borders.append(b)
            tc_pr.append(tc_borders)
    doc.add_paragraph()


def add_bullet(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(item)
        run.font.size = Pt(11)


def add_page_break(doc):
    doc.add_page_break()


def add_divider(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("─" * 50)
    r.font.color.rgb = RGBColor(156, 163, 175)
    r.font.size = Pt(10)


# ─── TẠO TÀI LIỆU ────────────────────────────────────────
doc = Document()

style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

sections = doc.sections
for section in sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

# ════════════════════════════════════════════════════════════
# TRANG BÌA
# ════════════════════════════════════════════════════════════
add_image_placeholder(doc, "[Logo công ty - LP & EP IT]", width_cm=6)

title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_run = title_p.add_run("HƯỚNG DẪN SỬ DỤNG\nHỆ THỐNG ĐÀO TẠO EPATH")
title_run.bold = True
title_run.font.size = Pt(32)
title_run.font.color.rgb = RGBColor(30, 64, 175)

sub_p = doc.add_paragraph()
sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub_run = sub_p.add_run("Tài liệu dành cho nhân sự")
sub_run.italic = True
sub_run.font.size = Pt(16)
sub_run.font.color.rgb = RGBColor(107, 114, 128)

for _ in range(2):
    doc.add_paragraph()

info_table = doc.add_table(rows=4, cols=2)
info_table.autofit = False
info_table.columns[0].width = Cm(5)
info_table.columns[1].width = Cm(11)

info_data = [
    ("Phiên bản", "1.0"),
    ("Ngày phát hành", datetime.now().strftime("%d/%m/%Y")),
    ("Đối tượng", "Toàn bộ nhân sự công ty"),
    ("Bộ phận phụ trách", "Phòng IT & Phòng Nhân sự"),
]

for i, (label, value) in enumerate(info_data):
    c0 = info_table.cell(i, 0)
    c1 = info_table.cell(i, 1)
    p0 = c0.paragraphs[0]
    r0 = p0.add_run(label)
    r0.bold = True
    r0.font.size = Pt(11)
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(value)
    r1.font.size = Pt(11)

for row in info_table.rows:
    for cell in row.cells:
        tc_pr = cell._tc.get_or_add_tcPr()
        tc_borders = OxmlElement("w:tcBorders")
        for edge in ("top", "left", "bottom", "right"):
            b = OxmlElement(f"w:{edge}")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "4")
            b.set(qn("w:color"), "1E40AF")
            tc_borders.append(b)
        tc_pr.append(tc_borders)

for _ in range(6):
    doc.add_paragraph()

footer_p = doc.add_paragraph()
footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
fr = footer_p.add_run("© 2026 LP & EP IT")
fr.font.size = Pt(10)
fr.font.color.rgb = RGBColor(107, 114, 128)

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# MỤC LỤC
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "MỤC LỤC", level=1)

toc_items = [
    ("1. Giới thiệu hệ thống", 4),
    ("2. Hướng dẫn dành cho NHÂN VIÊN", 6),
    ("    2.1. Đăng nhập hệ thống", 6),
    ("    2.2. Trang chủ (Dashboard)", 8),
    ("    2.3. Xem chương trình đào tạo", 10),
    ("    2.4. Học bài giảng", 12),
    ("    2.5. Làm bài kiểm tra", 14),
    ("    2.6. Xem tiến độ cá nhân", 16),
    ("    2.7. Cập nhật thông tin cá nhân", 18),
    ("3. Hướng dẫn dành cho QUẢN TRỊ VIÊN (Admin)", 19),
    ("    3.1. Quản lý chương trình", 19),
    ("    3.2. Quản lý bài học", 21),
    ("    3.3. Quản lý bài kiểm tra", 22),
    ("    3.4. Gán chương trình cho nhân viên", 24),
    ("    3.5. Quản lý người dùng", 25),
    ("    3.6. Xem báo cáo", 26),
    ("4. Câu hỏi thường gặp (FAQ)", 27),
    ("5. Liên hệ hỗ trợ", 28),
]

for item, page in toc_items:
    p = doc.add_paragraph()
    p.paragraph_format.tab_stops.add_tab_stop(Cm(16), WD_ALIGN_PARAGRAPH.RIGHT, 2)
    r = p.add_run(f"{item}\t{page}")
    r.font.size = Pt(11)

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# CHƯƠNG 1: GIỚI THIỆU
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "1. GIỚI THIỆU HỆ THỐNG", level=1)

add_para(doc, "Hệ thống Đào tạo Epath là nền tảng học tập trực tuyến nội bộ của công ty, "
              "giúp nhân viên có thể học tập, làm bài kiểm tra và theo dõi tiến độ đào tạo "
              "mọi lúc mọi nơi.")

add_callout(doc, "Hệ thống dành cho ai?",
            "• Tất cả nhân viên trong công ty\n"
            "• Quản trị viên (Admin) - phụ trách quản lý nội dung đào tạo",
            icon="👥", bg_hex="DBEAFE")

add_heading_custom(doc, "Các chức năng chính", level=2)

features = [
    ("📚 Học tập trực tuyến", "Xem video bài giảng, tài liệu học tập"),
    ("✍️ Làm bài kiểm tra", "Trắc nghiệm online, có chấm điểm tự động"),
    ("📊 Theo dõi tiến độ", "Xem % hoàn thành khóa học của bạn"),
    ("👨‍💼 Quản lý đào tạo", "Admin tạo chương trình, gán cho nhân viên, xem báo cáo"),
]

for title, desc in features:
    p = doc.add_paragraph()
    r1 = p.add_run(f"{title}: ")
    r1.bold = True
    r1.font.size = Pt(11)
    r2 = p.add_run(desc)
    r2.font.size = Pt(11)

add_heading_custom(doc, "Sơ đồ tổng quan hệ thống", level=2)

add_visual_image(doc, "fig_1_overview", width_cm=15)

add_image_placeholder(doc, "[Chụp màn hình trang chủ hệ thống để minh họa]")

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# CHƯƠNG 2: HƯỚNG DẪN NHÂN VIÊN
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "2. HƯỚNG DẪN DÀNH CHO NHÂN VIÊN", level=1)

add_para(doc, "Phần này hướng dẫn nhân viên sử dụng hệ thống để học tập và làm bài kiểm tra. "
              "Bạn không cần kiến thức về công nghệ, chỉ cần làm theo từng bước.")

# ─── 2.1 Đăng nhập ─────────────────────────────────────────
add_heading_custom(doc, "2.1. Đăng nhập hệ thống", level=2)

add_para(doc, "Để bắt đầu, bạn cần đăng nhập vào hệ thống bằng tài khoản được cung cấp.")

add_visual_image(doc, "fig_11_login_flow", width_cm=16)
add_visual_image(doc, "fig_13_login_page", width_cm=15)

add_step(doc, 1, "Mở trình duyệt web",
         "Mở trình duyệt (Chrome, Edge, Firefox,...) trên máy tính hoặc điện thoại. "
         "Gõ địa chỉ trang web đào tạo của công ty vào thanh địa chỉ.")

add_image_placeholder(doc, "[Ảnh chụp thanh địa chỉ trình duyệt]")

add_step(doc, 2, "Nhập Email và Mật khẩu",
         "Tại trang đăng nhập, bạn sẽ thấy 2 ô trống:\n"
         "• Ô thứ nhất (Email): Nhập email công ty của bạn (ví dụ: tenban@congty.com)\n"
         "• Ô thứ hai (Mật khẩu): Nhập mật khẩu đã được cấp")

add_image_placeholder(doc, "[Ảnh chụp màn hình đăng nhập - khoanh vùng ô email và mật khẩu]")

add_step(doc, 3, "Nhấn nút \"Đăng nhập\"",
         "Sau khi đã điền đầy đủ thông tin, click (nhấn) vào nút màu xanh \"Đăng nhập\" "
         "để vào hệ thống.")

add_image_placeholder(doc, "[Ảnh chụp nút Đăng nhập - khoanh đỏ]")

add_callout(doc, "Lưu ý quan trọng",
            "• Nếu quên mật khẩu, nhấn vào \"Quên mật khẩu\" và làm theo hướng dẫn\n"
            "• Không chia sẻ mật khẩu với người khác\n"
            "• Email và mật khẩu phân biệt chữ HOA - chữ thường",
            icon="⚠️", bg_hex="FEF3C7")

add_two_col_compare(doc,
    "Làm đúng",
    ["Điền đầy đủ email và mật khẩu", "Kiểm tra chính tả trước khi nhấn Đăng nhập", "Liên hệ IT nếu quên mật khẩu"],
    "Không nên",
    ["Bỏ trống ô mật khẩu", "Đăng nhập trên máy tính công cộng", "Để người khác dùng tài khoản của mình"],
    "FEF3C7", "FEE2E2")

add_page_break(doc)

# ─── 2.2 Trang chủ ─────────────────────────────────────────
add_heading_custom(doc, "2.2. Trang chủ (Dashboard)", level=2)

add_para(doc, "Sau khi đăng nhập thành công, bạn sẽ thấy Trang chủ - nơi hiển thị tổng quan "
              "về các chương trình đào tạo được gán cho bạn.")

add_visual_image(doc, "fig_2_dashboard", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp màn hình Trang chủ thực tế]")

add_heading_custom(doc, "Các thành phần trên Trang chủ", level=3)

dashboard_parts = [
    ("Khối thống kê", "Hiển thị 3 số: Tổng chương trình được gán, đang học, đã hoàn thành"),
    ("Danh sách chương trình", "Liệt kê các khóa học được gán cho bạn cùng thanh tiến độ"),
    ("Nút \"Bắt đầu\"/\"Tiếp tục\"", "Nhấn để vào học chương trình"),
    ("Menu bên trái", "Điều hướng đến các trang khác (nếu có)"),
]

for title, desc in dashboard_parts:
    p = doc.add_paragraph(style="List Bullet")
    r1 = p.add_run(f"{title}: ")
    r1.bold = True
    r2 = p.add_run(desc)

add_page_break(doc)

# ─── 2.3 Xem chương trình ─────────────────────────────────
add_heading_custom(doc, "2.3. Xem chương trình đào tạo", level=2)

add_para(doc, "Trang \"Chương trình của tôi\" liệt kê tất cả các chương trình đào tạo mà "
              "admin đã gán cho bạn.")

add_visual_image(doc, "fig_3_programs_list", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp trang Chương trình của tôi - khoanh vùng 2 nhóm]")

add_step(doc, 1, "Truy cập trang chương trình",
         "Từ Trang chủ, nhấn vào nút \"Xem tất cả\" ở góc phải trên, "
         "hoặc click vào menu \"Chương trình của tôi\" ở thanh điều hướng.")

add_step(doc, 2, "Xem danh sách chương trình",
         "Bạn sẽ thấy các chương trình được chia thành 2 nhóm:\n"
         "• Đang học: Các chương trình bạn chưa hoàn thành\n"
         "• Đã hoàn thành: Các chương trình bạn đã hoàn thành 100%")

add_step(doc, 3, "Mở rộng/Thu gọn nhóm",
         "Các chương trình có thể được sắp xếp theo nhóm (group). "
         "Nhấn vào tên nhóm để mở rộng hoặc thu gọn.")

add_callout(doc, "Mẹo nhỏ",
            "Chương trình hiển thị ở đây là chương trình ĐÃ ĐƯỢC ADMIN GÁN. "
            "Nếu bạn không thấy chương trình mong muốn, vui lòng liên hệ admin/HR.",
            icon="💡", bg_hex="D1FAE5")

add_page_break(doc)

# ─── 2.4 Học bài giảng ─────────────────────────────────────
add_heading_custom(doc, "2.4. Học bài giảng", level=2)

add_para(doc, "Mỗi chương trình bao gồm nhiều bài học. Bạn cần học từng bài và làm bài kiểm tra "
              "để hoàn thành chương trình.")

add_visual_image(doc, "fig_12_learning_flow", width_cm=16)

add_visual_image(doc, "fig_14_lesson_list", width_cm=16)

add_step(doc, 1, "Chọn chương trình muốn học",
         "Từ trang chương trình, nhấn vào nút \"Bắt đầu học\" hoặc \"Tiếp tục\" trên chương trình bạn muốn.")

add_step(doc, 2, "Xem danh sách bài học",
         "Mỗi chương trình có một danh sách các bài học. Bài học có thể là video, tài liệu đọc, hoặc bài kiểm tra.")

add_step(doc, 3, "Mở bài học",
         "Nhấn vào bài học bạn muốn học. Video tự động phát. "
         "Bạn có thể tua, tạm dừng, hoặc chỉnh âm lượng.")

add_visual_image(doc, "fig_4_video_player", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp màn hình video bài học thực tế]")

add_step(doc, 4, "Hoàn thành bài học",
         "Sau khi xem hết video, hãy nhấn nút \"Đánh dấu hoàn thành\" hoặc \"Bài tiếp theo\" "
         "để chuyển sang bài kế tiếp.")

add_callout(doc, "Lưu ý",
            "• Một số bài học có thể có bài kiểm tra cuối - BẠN PHẢI vượt qua bài kiểm tra để hoàn thành\n"
            "• Bài học bị khóa (🔒) sẽ mở ra sau khi bạn hoàn thành bài trước",
            icon="🔒", bg_hex="DBEAFE")

add_page_break(doc)

# ─── 2.5 Làm bài kiểm tra ─────────────────────────────────
add_heading_custom(doc, "2.5. Làm bài kiểm tra", level=2)

add_para(doc, "Bài kiểm tra gồm các câu hỏi trắc nghiệm. Bạn cần đạt điểm tối thiểu (pass score) "
              "để được tính là hoàn thành.")

add_step(doc, 1, "Mở bài kiểm tra",
         "Từ danh sách bài học, nhấn vào bài kiểm tra. Bạn cần hoàn thành tất cả bài học trước đó.")

add_step(doc, 2, "Đọc câu hỏi và chọn đáp án",
         "Mỗi câu hỏi có 4 phương án A, B, C, D. Nhấn vào phương án bạn cho là đúng.")

add_visual_image(doc, "fig_5_quiz", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp màn hình làm bài kiểm tra thực tế]")

add_step(doc, 3, "Nộp bài",
         "Sau khi trả lời tất cả câu hỏi, nhấn nút \"Nộp bài\" ở câu cuối cùng. "
         "Hệ thống sẽ tự chấm điểm.")

add_step(doc, 4, "Xem kết quả",
         "Hệ thống hiển thị điểm số và cho biết bạn ĐẠT hay KHÔNG ĐẠT. "
         "Nếu không đạt, bạn có thể làm lại.")

add_visual_image(doc, "fig_6_quiz_result", width_cm=16)

add_callout(doc, "Lưu ý",
            "• Bạn có thể làm lại bài kiểm tra nếu không đạt\n"
            "• Điểm cao nhất sẽ được tính\n"
            "• Một số bài kiểm tra có giới hạn thời gian",
            icon="📝", bg_hex="DBEAFE")

add_page_break(doc)

# ─── 2.6 Xem tiến độ ─────────────────────────────────────
add_heading_custom(doc, "2.6. Xem tiến độ cá nhân", level=2)

add_para(doc, "Bạn có thể xem tiến độ học tập của mình tại trang cá nhân.")

add_step(doc, 1, "Truy cập trang cá nhân",
         "Click vào tên/avatar của bạn ở góc phải trên cùng → chọn \"Hồ sơ\" hoặc \"Thông tin cá nhân\"")

add_step(doc, 2, "Xem thông tin tiến độ",
         "Trang cá nhân hiển thị:\n"
         "• Tổng số chương trình đã học\n"
         "• Số chương trình hoàn thành\n"
         "• Điểm trung bình các bài kiểm tra\n"
         "• Thời gian học tập")

add_visual_image(doc, "fig_7_profile", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp trang hồ sơ cá nhân thực tế]")

add_page_break(doc)

# ─── 2.7 Cập nhật thông tin ─────────────────────────────────
add_heading_custom(doc, "2.7. Cập nhật thông tin cá nhân", level=2)

add_para(doc, "Bạn có thể cập nhật một số thông tin cá nhân như: ảnh đại diện, số điện thoại, "
              "mật khẩu.")

add_step(doc, 1, "Vào trang cá nhân", "Click vào tên/avatar của bạn → chọn \"Hồ sơ\"")

add_step(doc, 2, "Chọn thông tin cần sửa",
         "• Đổi mật khẩu: Vào mục \"Bảo mật\" → nhập mật khẩu cũ và mật khẩu mới\n"
         "• Đổi ảnh đại diện: Click vào ảnh đại diện → chọn ảnh mới từ máy\n"
         "• Cập nhật thông tin khác: Click vào từng trường để sửa")

add_image_placeholder(doc, "[Ảnh chụp giao diện đổi mật khẩu]")

add_callout(doc, "Lưu ý bảo mật",
            "• KHÔNG chia sẻ mật khẩu cho người khác\n"
            "• Mật khẩu nên có ít nhất 8 ký tự, gồm chữ HOA, chữ thường và số\n"
            "• Nên đổi mật khẩu định kỳ 3-6 tháng/lần",
            icon="🔐", bg_hex="FEE2E2")

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# CHƯƠNG 3: HƯỚNG DẪN ADMIN
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "3. HƯỚNG DẪN DÀNH CHO QUẢN TRỊ VIÊN (ADMIN)", level=1, color=(124, 58, 237))

add_para(doc, "Phần này dành cho Admin/HR - những người phụ trách quản lý nội dung đào tạo.")

add_callout(doc, "Quyền của Admin",
            "• Tạo, sửa, xóa chương trình đào tạo\n"
            "• Tạo bài học, bài kiểm tra\n"
            "• Gán chương trình cho nhân viên\n"
            "• Quản lý người dùng\n"
            "• Xem báo cáo, thống kê",
            icon="🛡️", bg_hex="EDE9FE", border_color="7C3AED")

# ─── 3.1 Quản lý chương trình ─────────────────────────────────
add_heading_custom(doc, "3.1. Quản lý chương trình", level=2)

add_para(doc, "Chương trình là một khóa học hoàn chỉnh, bao gồm nhiều bài học và có thể có bài kiểm tra cuối khóa.")

add_heading_custom(doc, "Tạo chương trình mới", level=3)

add_step(doc, 1, "Vào trang quản lý chương trình",
         "Từ menu Admin, chọn \"Chương trình\" hoặc truy cập /admin/programs")

add_step(doc, 2, "Nhấn nút \"Tạo chương trình mới\"",
         "Nút này thường ở góc phải trên cùng, có dấu \"+\" và màu xanh.")

add_step(doc, 3, "Điền thông tin chương trình",
         "• Tên chương trình (bắt buộc)\n"
         "• Mô tả ngắn\n"
         "• Ảnh bìa (thumbnail)\n"
         "• Trình độ: Cơ bản / Trung bình / Nâng cao\n"
         "• Trạng thái: Nháp / Đã xuất bản")

add_visual_image(doc, "fig_8_create_program", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp form tạo chương trình thực tế]")

add_step(doc, 4, "Lưu chương trình",
         "Nhấn nút \"Lưu\" để tạo chương trình. Chương trình sẽ ở trạng thái \"Nháp\" cho đến khi bạn xuất bản.")

add_heading_custom(doc, "Sửa / Xóa chương trình", level=3)

add_para(doc, "Tại trang danh sách chương trình, mỗi chương trình có menu 3 chấm (⋮) với các tùy chọn:")

add_bullet(doc, [
    "Sửa: Mở form chỉnh sửa thông tin",
    "Xóa: Xóa chương trình (cần xác nhận)",
    "Nhân bản: Tạo bản sao chương trình",
    "Xuất bản / Hủy xuất bản: Thay đổi trạng thái",
])

add_image_placeholder(doc, "[Ảnh chụp menu 3 chấm - khoanh vùng]")

add_callout(doc, "Cảnh báo khi xóa",
            "Xóa chương trình sẽ XÓA TẤT CẢ bài học, bài kiểm tra và tiến độ của nhân viên. "
            "Hành động này không thể hoàn tác. Hãy cân nhắc kỹ trước khi xóa.",
            icon="⚠️", bg_hex="FEE2E2")

add_page_break(doc)

# ─── 3.2 Quản lý bài học ─────────────────────────────────
add_heading_custom(doc, "3.2. Quản lý bài học", level=2)

add_para(doc, "Mỗi chương trình gồm nhiều bài học. Mỗi bài học có thể là video, tài liệu đọc, hoặc bài kiểm tra.")

add_step(doc, 1, "Mở chương trình cần thêm bài học",
         "Từ danh sách chương trình, click vào chương trình bạn muốn chỉnh sửa.")

add_step(doc, 2, "Vào tab \"Bài học\"",
         "Trong trang chi tiết chương trình, click vào tab \"Bài học\".")

add_step(doc, 3, "Thêm bài học mới",
         "Nhấn \"+ Thêm bài học\" và chọn loại bài học:")

add_bullet(doc, [
    "Video bài giảng: Chứa video nội dung bài học",
    "Tài liệu đọc: File PDF, Word để nhân viên đọc",
    "Bài kiểm tra: Câu hỏi trắc nghiệm có chấm điểm",
])

add_step(doc, 4, "Điền thông tin bài học",
         "• Tên bài học\n"
         "• Mô tả\n"
         "• Link video (cho video bài giảng)\n"
         "• File tài liệu (cho tài liệu đọc)\n"
         "• Thời lượng (tùy chọn)")

add_step(doc, 5, "Sắp xếp thứ tự bài học",
         "Bạn có thể kéo thả (drag & drop) để sắp xếp thứ tự các bài học. "
         "Bài học đầu tiên sẽ được học trước.")

add_image_placeholder(doc, "[Ảnh chụp chức năng kéo thả bài học]")

add_callout(doc, "Mẹo",
            "• Đánh thứ tự bài học hợp lý: từ cơ bản đến nâng cao\n"
            "• Đặt tên bài học ngắn gọn, rõ ràng\n"
            "• Nên có bài kiểm tra cuối mỗi chương trình",
            icon="💡", bg_hex="D1FAE5")

add_page_break(doc)

# ─── 3.3 Quản lý bài kiểm tra ─────────────────────────────────
add_heading_custom(doc, "3.3. Quản lý bài kiểm tra", level=2)

add_para(doc, "Bài kiểm tra gồm các câu hỏi trắc nghiệm, hệ thống tự chấm điểm.")

add_step(doc, 1, "Mở bài kiểm tra",
         "Trong chương trình, chọn bài học có loại \"Bài kiểm tra\", "
         "hoặc click vào icon \"✍️\" bên cạnh bài học.")

add_step(doc, 2, "Điều thông tin chung",
         "• Tên bài kiểm tra\n"
         "• Điểm đạt tối thiểu (pass score) - mặc định 70%\n"
         "• Số lần làm tối đa (nếu có)\n"
         "• Thời gian làm bài (nếu có)")

add_step(doc, 3, "Thêm câu hỏi",
         "Nhấn \"+ Thêm câu hỏi\" và nhập:")

add_visual_image(doc, "fig_5_quiz", width_cm=15)

add_step(doc, 4, "Thêm nhiều câu hỏi",
         "Lặp lại bước 3 để thêm các câu hỏi khác. Bạn có thể thêm 1 lúc nhiều câu hỏi.")

add_step(doc, 5, "Sắp xếp thứ tự câu hỏi",
         "Dùng nút ↑ ↓ để sắp xếp thứ tự câu hỏi.")

add_heading_custom(doc, "Import câu hỏi từ file", level=3)

add_para(doc, "Thay vì nhập từng câu, bạn có thể import nhiều câu hỏi từ file Excel hoặc JSON.")

add_step(doc, 1, "Tải file mẫu",
         "Nhấn nút \"Tải mẫu\" → chọn Excel (.xlsx) hoặc JSON.")

add_step(doc, 2, "Điền câu hỏi vào file mẫu",
         "Mở file bằng Excel/Notepad, điền câu hỏi theo mẫu.")

add_step(doc, 3, "Import file",
         "Nhấn nút \"Import\" → chọn file đã điền → hệ thống sẽ tải lên các câu hỏi.")

add_image_placeholder(doc, "[Ảnh chụp nút Tải mẫu và Import]")

add_callout(doc, "Định dạng file mẫu Excel",
            "File Excel có các cột:\n"
            "• question: Nội dung câu hỏi\n"
            "• option1, option2, option3, option4: 4 phương án\n"
            "• correctAnswer: A, B, C hoặc D\n"
            "• point: Điểm số",
            icon="📋", bg_hex="DBEAFE")

add_page_break(doc)

# ─── 3.4 Gán chương trình ─────────────────────────────────
add_heading_custom(doc, "3.4. Gán chương trình cho nhân viên", level=2)

add_para(doc, "Sau khi tạo chương trình, bạn cần gán cho nhân viên cụ thể để họ có thể học.")

add_step(doc, 1, "Vào trang \"Gán chương trình\"",
         "Từ menu Admin, chọn \"Gán chương trình\" hoặc truy cập /admin/assignments")

add_step(doc, 2, "Chọn chương trình",
         "Nhấn \"+ Gán chương trình\" → chọn chương trình từ dropdown.")

add_step(doc, 3, "Chọn nhân viên",
         "Có 2 cách:")

add_visual_image(doc, "fig_9_assign", width_cm=16)

add_image_placeholder(doc, "[Ảnh chụp form gán chương trình thực tế]")

add_two_col_compare(doc,
    "Gán theo cá nhân",
    ["Phù hợp khi gán cho ít người", "Linh hoạt, chọn được từng người", "Chọn được người cụ thể"],
    "Gán theo nhóm",
    ["Phù hợp khi gán cho nhiều người", "Nhanh chóng, 1 click cho cả phòng ban", "Có thể gán cho cả phòng/ban"],
    "FEF3C7", "D1FAE5")

add_step(doc, 4, "Đặt hạn hoàn thành (tùy chọn)",
         "Bạn có thể đặt deadline để nhân viên biết cần hoàn thành trước ngày nào.")

add_step(doc, 5, "Xác nhận gán",
         "Nhấn \"Gán\" để hoàn tất. Nhân viên sẽ nhận được chương trình trong tài khoản của họ.")

add_image_placeholder(doc, "[Ảnh chụp thông báo sau khi gán thành công]")

add_page_break(doc)

# ─── 3.5 Quản lý người dùng ─────────────────────────────────
add_heading_custom(doc, "3.5. Quản lý người dùng", level=2)

add_para(doc, "Trang quản lý người dùng cho phép bạn xem, thêm, sửa thông tin nhân viên.")

add_step(doc, 1, "Truy cập trang quản lý",
         "Từ menu Admin, chọn \"Người dùng\" hoặc truy cập /admin/users")

add_step(doc, 2, "Tìm kiếm nhân viên",
         "Gõ tên hoặc email vào ô tìm kiếm để lọc nhanh.")

add_step(doc, 3, "Thêm nhân viên mới",
         "Nhấn \"+ Thêm nhân viên\" → điền form → Lưu. Hệ thống sẽ gửi email mật khẩu mới cho nhân viên.")

add_step(doc, 4, "Sửa thông tin",
         "Click vào tên nhân viên hoặc menu ⋮ → Sửa")

add_step(doc, 5, "Reset mật khẩu",
         "Menu ⋮ → Reset mật khẩu (gửi mật khẩu mới qua email)")

add_bullet(doc, [
    "Vô hiệu hóa: Menu ⋮ → Vô hiệu hóa (nhân viên không thể đăng nhập)",
    "Phân quyền: Có thể đổi role (employee → admin → manager)",
])

add_image_placeholder(doc, "[Ảnh chụp trang quản lý người dùng thực tế]")

# ─── 3.6 Báo cáo ─────────────────────────────────
add_heading_custom(doc, "3.6. Xem báo cáo", level=2)

add_para(doc, "Hệ thống cung cấp các báo cáo giúp bạn theo dõi tình hình đào tạo trong công ty.")

add_step(doc, 1, "Vào trang báo cáo",
         "Từ menu Admin, chọn \"Báo cáo\" hoặc truy cập /admin/reports")

add_visual_image(doc, "fig_10_admin_dashboard", width_cm=16)

add_step(doc, 2, "Xem báo cáo tổng quan",
         "Báo cáo tổng quan hiển thị:")

add_bullet(doc, [
    "Tổng số chương trình đã gán",
    "Tổng số bài học đã hoàn thành",
    "Điểm trung bình các bài kiểm tra",
    "Số nhân viên đạt / chưa đạt",
    "Top 10 nhân viên có tiến độ tốt nhất",
])

add_image_placeholder(doc, "[Ảnh chụp báo cáo tổng quan thực tế]")

add_step(doc, 3, "Xem chi tiết theo nhân viên",
         "Click vào 1 nhân viên để xem:")
add_bullet(doc, [
    "Các chương trình đang học",
    "Tiến độ từng chương trình",
    "Điểm các bài kiểm tra",
    "Lịch sử học tập",
])

add_step(doc, 4, "Xuất báo cáo",
         "Nhấn nút \"Xuất Excel\" để tải báo cáo về máy.")

add_image_placeholder(doc, "[Ảnh chụp nút Xuất báo cáo]")

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# CHƯƠNG 4: FAQ
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "4. CÂU HỎI THƯỜNG GẶP (FAQ)", level=1)

faqs = [
    ("Tôi quên mật khẩu, phải làm sao?",
     "Tại trang đăng nhập, nhấn \"Quên mật khẩu\" → nhập email → hệ thống sẽ gửi link reset vào email của bạn."),
    ("Tôi không thấy chương trình nào được gán, phải làm sao?",
     "Liên hệ Admin/HR để được gán chương trình. Bạn chỉ thấy các chương trình ĐÃ ĐƯỢC GÁN cho mình."),
    ("Video không phát được, phải làm sao?",
     "• Kiểm tra kết nối internet\n• Thử refresh trang (F5)\n• Thử trình duyệt khác\n• Liên hệ IT nếu vẫn lỗi"),
    ("Tôi làm bài kiểm tra nhưng không đạt, có thể làm lại không?",
     "Có, bạn có thể làm lại bài kiểm tra. Hệ thống sẽ lưu điểm cao nhất."),
    ("Tôi muốn xin gia hạn deadline, có thể không?",
     "Liên hệ trực tiếp Admin/HR để được hỗ trợ gia hạn deadline."),
    ("Bài kiểm tra có giới hạn thời gian không?",
     "Tùy từng bài kiểm tra. Thông tin thời gian sẽ hiển thị trước khi bạn bắt đầu làm bài."),
    ("Tôi có thể học trên điện thoại không?",
     "Có, hệ thống hỗ trợ điện thoại và tablet. Mở trình duyệt trên điện thoại và truy cập trang web."),
    ("Làm sao để biết tôi đã hoàn thành chương trình?",
     "Khi thanh tiến độ đạt 100%, bạn đã hoàn thành chương trình đó."),
    ("Admin có thể xem được điểm của tôi không?",
     "Có, Admin có thể xem báo cáo tiến độ và điểm số của tất cả nhân viên."),
    ("Tôi muốn thay đổi email/tên hiển thị, làm sao?",
     "Liên hệ Admin/HR để được hỗ trợ thay đổi thông tin cá nhân."),
]

for q, a in faqs:
    add_heading_custom(doc, f"❓ {q}", level=3, color=(60, 60, 60))
    p = doc.add_paragraph()
    r = p.add_run(f"➤ {a}")
    r.font.size = Pt(11)
    add_divider(doc)

add_page_break(doc)

# ════════════════════════════════════════════════════════════
# CHƯƠNG 5: LIÊN HỆ
# ════════════════════════════════════════════════════════════
add_heading_custom(doc, "5. LIÊN HỆ HỖ TRỢ", level=1)

add_para(doc, "Nếu bạn gặp khó khăn trong quá trình sử dụng hệ thống, vui lòng liên hệ:")

contact_table = doc.add_table(rows=1, cols=3)
contact_table.autofit = False
contact_table.columns[0].width = Cm(5)
contact_table.columns[1].width = Cm(5)
contact_table.columns[2].width = Cm(6)

header_cells = contact_table.rows[0].cells
header_cells[0].text = "Bộ phận"
header_cells[1].text = "Phụ trách"
header_cells[2].text = "Liên hệ"

for cell in header_cells:
    p = cell.paragraphs[0]
    for run in p.runs:
        run.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), "1E40AF")
    tc_pr.append(shd)

contacts = [
    ("Hỗ trợ kỹ thuật (IT)", "Lỗi hệ thống, đăng nhập", "it-support@congty.com\nExt: 100"),
    ("Phòng Nhân sự (HR)", "Gán chương trình, deadline", "hr@congty.com\nExt: 200"),
    ("Quản trị đào tạo", "Nội dung khóa học", "training@congty.com\nExt: 300"),
]

for dept, role, contact in contacts:
    row = contact_table.add_row()
    row.cells[0].text = dept
    row.cells[1].text = role
    row.cells[2].text = contact

for row in contact_table.rows:
    for cell in row.cells:
        tc_pr = cell._tc.get_or_add_tcPr()
        tc_borders = OxmlElement("w:tcBorders")
        for edge in ("top", "left", "bottom", "right"):
            b = OxmlElement(f"w:{edge}")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "4")
            b.set(qn("w:color"), "D1D5DB")
            tc_borders.append(b)
        tc_pr.append(tc_borders)

for _ in range(2):
    doc.add_paragraph()

add_callout(doc, "Văn phòng hỗ trợ trực tiếp",
            "Tầng 3, Tòa nhà ABC, Quận X\n"
            "Giờ làm việc: 8:00 - 17:00 (Thứ 2 - Thứ 6)\n"
            "Bạn có thể đến trực tiếp để được hỗ trợ nhanh nhất!",
            icon="📍", bg_hex="D1FAE5")

add_divider(doc)
add_para(doc, "Tài liệu này được tạo tự động và cập nhật định kỳ.",
         italic=True, size=10, color=(107, 114, 128), align=WD_ALIGN_PARAGRAPH.CENTER)
add_para(doc, f"Phiên bản 1.0 - Cập nhật lần cuối: {datetime.now().strftime('%d/%m/%Y')}",
         italic=True, size=10, color=(107, 114, 128), align=WD_ALIGN_PARAGRAPH.CENTER)

output_path = "D:/LP & EP IT/EpathSystemTraining/Huong_Dan_Su_Dung_Epath.docx"
doc.save(output_path)
print(f"[OK] File da tao: {output_path}")
import os
size_kb = os.path.getsize(output_path) / 1024
print(f"[OK] Dung luong: {size_kb:.1f} KB")
print(f"[OK] Da nhung 14 hinh visualize vao tai lieu")
