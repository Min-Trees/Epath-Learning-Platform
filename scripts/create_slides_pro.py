"""
Script tao PowerPoint huong dan he thong E-Path Training
Thiet ke chuan doanh nghiep - Co cho chen anh
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Tao presentation moi - widescreen 16:9
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Mau sac thuong hieu
BRAND_BLUE = RGBColor(0, 82, 147)      # #005293 - Xanh dam chuyen nghiep
ACCENT_ORANGE = RGBColor(255, 133, 0)   # #FF8500 - Cam accent
LIGHT_GRAY = RGBColor(248, 248, 248)    # #F8F8F8 - Xam nhe
DARK_GRAY = RGBColor(64, 64, 64)        # #404040
WHITE = RGBColor(255, 255, 255)
BLACK = RGBColor(0, 0, 0)


def add_cover_slide(prs, title, subtitle, department="Phong Nhan su - HR"):
    """Slide bia - Cover page"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Background gradient effect (using shapes)
    # Top bar
    top_bar = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(0.15)
    )
    top_bar.fill.solid()
    top_bar.fill.fore_color.rgb = BRAND_BLUE
    top_bar.line.fill.background()
    
    # Left accent bar
    left_bar = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.4), prs.slide_height
    )
    left_bar.fill.solid()
    left_bar.fill.fore_color.rgb = BRAND_BLUE
    left_bar.line.fill.background()
    
    # Logo placeholder box (top right)
    logo_box = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.5), Inches(0.4), Inches(2.5), Inches(1)
    )
    logo_box.fill.solid()
    logo_box.fill.fore_color.rgb = RGBColor(230, 240, 250)
    logo_box.line.color.rgb = BRAND_BLUE
    logo_box.line.width = Pt(1)
    
    # Logo text
    logo_text = slide.shapes.add_textbox(Inches(10.6), Inches(0.6), Inches(2.3), Inches(0.6))
    tf = logo_text.text_frame
    p = tf.paragraphs[0]
    p.text = "[COMPANY LOGO]"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = BRAND_BLUE
    p.alignment = PP_ALIGN.CENTER
    
    # Main title
    title_box = slide.shapes.add_textbox(Inches(1), Inches(2.2), Inches(11), Inches(1.5))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(48)
    p.font.bold = True
    p.font.color.rgb = BRAND_BLUE
    p.alignment = PP_ALIGN.LEFT
    
    # Subtitle
    sub_box = slide.shapes.add_textbox(Inches(1), Inches(3.8), Inches(11), Inches(1))
    tf = sub_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = subtitle
    p.font.size = Pt(24)
    p.font.color.rgb = DARK_GRAY
    p.alignment = PP_ALIGN.LEFT
    
    # Decorative line
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(1), Inches(5), Inches(3), Inches(0.08)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = ACCENT_ORANGE
    line.line.fill.background()
    
    # Department info
    dept_box = slide.shapes.add_textbox(Inches(1), Inches(5.5), Inches(11), Inches(0.5))
    tf = dept_box.text_frame
    p = tf.paragraphs[0]
    p.text = department
    p.font.size = Pt(16)
    p.font.color.rgb = DARK_GRAY
    p.alignment = PP_ALIGN.LEFT
    
    # Bottom bar
    bottom_bar = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(7.2), prs.slide_width, Inches(0.3)
    )
    bottom_bar.fill.solid()
    bottom_bar.fill.fore_color.rgb = BRAND_BLUE
    bottom_bar.line.fill.background()
    
    return slide


def add_content_slide(prs, title, content_list, image_path=None, two_column=False):
    """Slide noi dung co cho chen anh"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Header bar
    header = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.3)
    )
    header.fill.solid()
    header.fill.fore_color.rgb = BRAND_BLUE
    header.line.fill.background()
    
    # Left accent
    accent = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(1.3), Inches(0.15), Inches(6.2)
    )
    accent.fill.solid()
    accent.fill.fore_color.rgb = ACCENT_ORANGE
    accent.line.fill.background()
    
    # Title
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.35), Inches(12), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = WHITE
    
    # Slide number
    num_box = slide.shapes.add_textbox(Inches(12.5), Inches(0.35), Inches(0.6), Inches(0.5))
    tf = num_box.text_frame
    p = tf.paragraphs[0]
    p.text = f"{len(prs.slides)}"
    p.font.size = Pt(16)
    p.font.color.rgb = RGBColor(200, 220, 240)
    p.alignment = PP_ALIGN.RIGHT
    
    if two_column:
        # Two column layout
        # Left content
        left_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.6), Inches(5.8), Inches(5.5))
        tf = left_box.text_frame
        tf.word_wrap = True
        
        for i, item in enumerate(content_list):
            if i == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()
            
            if isinstance(item, dict):
                p.text = f"• {item['text']}"
                p.font.size = Pt(item.get('size', 18))
                p.space_after = Pt(item.get('space', 10))
            else:
                p.text = f"• {item}"
                p.font.size = Pt(18)
                p.space_after = Pt(10)
            p.font.color.rgb = BLACK
        
        # Right image placeholder
        img_placeholder = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.6), Inches(6), Inches(5.2)
        )
        img_placeholder.fill.solid()
        img_placeholder.fill.fore_color.rgb = LIGHT_GRAY
        img_placeholder.line.color.rgb = RGBColor(200, 200, 200)
        img_placeholder.line.width = Pt(2)
        
        # Image placeholder text
        img_text = slide.shapes.add_textbox(Inches(6.8), Inches(3.8), Inches(6), Inches(1))
        tf = img_text.text_frame
        p = tf.paragraphs[0]
        p.text = "[Chen hinh mo ta tai day]"
        p.font.size = Pt(20)
        p.font.color.rgb = RGBColor(150, 150, 150)
        p.alignment = PP_ALIGN.CENTER
        
        # Icon indicator
        icon_box = slide.shapes.add_textbox(Inches(9.3), Inches(3.2), Inches(1), Inches(0.5))
        tf = icon_box.text_frame
        p = tf.paragraphs[0]
        p.text = "[IMG]"
        p.font.size = Pt(12)
        p.font.color.rgb = RGBColor(180, 180, 180)
        p.alignment = PP_ALIGN.CENTER
        
    else:
        # Single column with image placeholder at bottom
        content_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.6), Inches(7.5), Inches(4))
        tf = content_box.text_frame
        tf.word_wrap = True
        
        for i, item in enumerate(content_list):
            if i == 0:
                p = tf.paragraphs[0]
            else:
                p = tf.add_paragraph()
            
            if isinstance(item, dict):
                p.text = f"• {item['text']}"
                p.font.size = Pt(item.get('size', 18))
                p.font.bold = item.get('bold', False)
                p.font.color.rgb = BLACK
                p.space_after = Pt(item.get('space', 8))
            else:
                p.text = f"• {item}"
                p.font.size = Pt(18)
                p.font.color.rgb = BLACK
                p.space_after = Pt(10)
        
        # Image placeholder (right side)
        img_placeholder = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.3), Inches(1.6), Inches(4.5), Inches(5.2)
        )
        img_placeholder.fill.solid()
        img_placeholder.fill.fore_color.rgb = LIGHT_GRAY
        img_placeholder.line.color.rgb = RGBColor(200, 200, 200)
        img_placeholder.line.width = Pt(2)
        
        # Image text
        img_text = slide.shapes.add_textbox(Inches(8.3), Inches(3.8), Inches(4.5), Inches(1))
        tf = img_text.text_frame
        p = tf.paragraphs[0]
        p.text = "[Chen hinh mo ta tai day]"
        p.font.size = Pt(16)
        p.font.color.rgb = RGBColor(150, 150, 150)
        p.alignment = PP_ALIGN.CENTER
    
    # Footer
    footer = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(7.2), prs.slide_width, Inches(0.3)
    )
    footer.fill.solid()
    footer.fill.fore_color.rgb = BRAND_BLUE
    footer.line.fill.background()
    
    return slide


def add_step_slide(prs, title, steps, image_path=None):
    """Slide huong dan theo buoc - step by step"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Header
    header = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.3)
    )
    header.fill.solid()
    header.fill.fore_color.rgb = BRAND_BLUE
    header.line.fill.background()
    
    # Left accent
    accent = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(1.3), Inches(0.15), Inches(6.2)
    )
    accent.fill.solid()
    accent.fill.fore_color.rgb = ACCENT_ORANGE
    accent.line.fill.background()
    
    # Title
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.35), Inches(12), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = WHITE
    
    # Steps
    step_height = Inches(1.1)
    start_y = Inches(1.6)
    
    for i, step in enumerate(steps):
        y = start_y + (i * step_height)
        
        # Step number circle
        circle = slide.shapes.add_shape(
            MSO_SHAPE.OVAL, Inches(0.5), y, Inches(0.6), Inches(0.6)
        )
        circle.fill.solid()
        circle.fill.fore_color.rgb = BRAND_BLUE
        circle.line.fill.background()
        
        # Number
        num_box = slide.shapes.add_textbox(Inches(0.5), y + Inches(0.1), Inches(0.6), Inches(0.4))
        tf = num_box.text_frame
        p = tf.paragraphs[0]
        p.text = str(i + 1)
        p.font.size = Pt(20)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER
        
        # Step content
        step_box = slide.shapes.add_textbox(Inches(1.3), y + Inches(0.05), Inches(6.5), Inches(0.9))
        tf = step_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = step
        p.font.size = Pt(18)
        p.font.color.rgb = BLACK
        
        # Connector line
        if i < len(steps) - 1:
            line = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE, Inches(0.78), y + Inches(0.65), Inches(0.04), Inches(0.45)
            )
            line.fill.solid()
            line.fill.fore_color.rgb = RGBColor(200, 200, 200)
            line.line.fill.background()
    
    # Image placeholder (right side)
    img_placeholder = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.3), Inches(1.6), Inches(4.5), Inches(5.2)
    )
    img_placeholder.fill.solid()
    img_placeholder.fill.fore_color.rgb = LIGHT_GRAY
    img_placeholder.line.color.rgb = RGBColor(200, 200, 200)
    img_placeholder.line.width = Pt(2)
    
    img_text = slide.shapes.add_textbox(Inches(8.3), Inches(3.8), Inches(4.5), Inches(1))
    tf = img_text.text_frame
    p = tf.paragraphs[0]
    p.text = "[Chen hinh minh hoa tai day]"
    p.font.size = Pt(16)
    p.font.color.rgb = RGBColor(150, 150, 150)
    p.alignment = PP_ALIGN.CENTER
    
    # Footer
    footer = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(7.2), prs.slide_width, Inches(0.3)
    )
    footer.fill.solid()
    footer.fill.fore_color.rgb = BRAND_BLUE
    footer.line.fill.background()
    
    return slide


def add_table_slide(prs, title, headers, rows, image_path=None):
    """Slide voi bang thong tin"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Header
    header = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.3)
    )
    header.fill.solid()
    header.fill.fore_color.rgb = BRAND_BLUE
    header.line.fill.background()
    
    # Left accent
    accent = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(1.3), Inches(0.15), Inches(6.2)
    )
    accent.fill.solid()
    accent.fill.fore_color.rgb = ACCENT_ORANGE
    accent.line.fill.background()
    
    # Title
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.35), Inches(12), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = WHITE
    
    # Table
    from pptx.table import Table
    
    num_rows = len(rows) + 1
    num_cols = len(headers)
    table_width = Inches(7)
    table_height = Inches(min(num_rows * 0.5, 5))
    
    table = slide.shapes.add_table(
        num_rows, num_cols, Inches(0.5), Inches(1.6), table_width, table_height
    ).table
    
    # Style header
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = BRAND_BLUE
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.font.size = Pt(14)
        p.alignment = PP_ALIGN.CENTER
    
    # Fill data
    for row_idx, row in enumerate(rows):
        for col_idx, cell_text in enumerate(row):
            cell = table.cell(row_idx + 1, col_idx)
            cell.text = str(cell_text)
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(12)
            p.font.color.rgb = BLACK
            if row_idx % 2 == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor(245, 245, 245)
    
    # Image placeholder
    img_placeholder = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.3), Inches(1.6), Inches(4.5), Inches(5.2)
    )
    img_placeholder.fill.solid()
    img_placeholder.fill.fore_color.rgb = LIGHT_GRAY
    img_placeholder.line.color.rgb = RGBColor(200, 200, 200)
    img_placeholder.line.width = Pt(2)
    
    img_text = slide.shapes.add_textbox(Inches(8.3), Inches(3.8), Inches(4.5), Inches(1))
    tf = img_text.text_frame
    p = tf.paragraphs[0]
    p.text = "[Chen hinh minh hoa]"
    p.font.size = Pt(16)
    p.font.color.rgb = RGBColor(150, 150, 150)
    p.alignment = PP_ALIGN.CENTER
    
    # Footer
    footer = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, Inches(7.2), prs.slide_width, Inches(0.3)
    )
    footer.fill.solid()
    footer.fill.fore_color.rgb = BRAND_BLUE
    footer.line.fill.background()
    
    return slide


def add_end_slide(prs, title, message, contact=""):
    """Slide ket thuc - Thank you"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Background
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = BRAND_BLUE
    bg.line.fill.background()
    
    # Decorative circle
    circle1 = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(-2), Inches(-2), Inches(6), Inches(6)
    )
    circle1.fill.solid()
    circle1.fill.fore_color.rgb = RGBColor(0, 102, 180)
    circle1.line.fill.background()
    
    circle2 = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(10), Inches(4), Inches(5), Inches(5)
    )
    circle2.fill.solid()
    circle2.fill.fore_color.rgb = RGBColor(0, 102, 180)
    circle2.line.fill.background()
    
    # Main text
    main_box = slide.shapes.add_textbox(Inches(1), Inches(2.5), Inches(11), Inches(1.5))
    tf = main_box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(56)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER
    
    # Message
    msg_box = slide.shapes.add_textbox(Inches(1), Inches(4.2), Inches(11), Inches(1))
    tf = msg_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = message
    p.font.size = Pt(24)
    p.font.color.rgb = RGBColor(200, 220, 240)
    p.alignment = PP_ALIGN.CENTER
    
    # Contact
    if contact:
        contact_box = slide.shapes.add_textbox(Inches(1), Inches(5.5), Inches(11), Inches(0.8))
        tf = contact_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = contact
        p.font.size = Pt(16)
        p.font.color.rgb = RGBColor(180, 200, 220)
        p.alignment = PP_ALIGN.CENTER
    
    return slide


# ============ TAO CAC SLIDE ============

# SLIDE 1: Bia
add_cover_slide(
    prs,
    "HE THONG DAO TAO TRUC TUYEN",
    "Huong dan su dung E-Path Training",
    "Phong Nhan su - HR Department"
)

# SLIDE 2: Muc luc
add_content_slide(prs, "Muc luc", [
    "01. Dang nhap he thong",
    "02. Giao dien chinh - Dashboard",
    "03. Chuang trinh dao tao",
    "04. Bai hoc va video",
    "05. Tai lieu dinh kem",
    "06. Bai kiem tra",
    "07. Theo doi tien do hoc tap",
    "08. Gui yeu cau ho tro",
    "09. Theo doi yeu cau ho tro",
    "10. Thong tin lien he",
])

# SLIDE 3: Dang nhap
add_step_slide(prs, "01. Dang nhap He thong", [
    "Truy cap dia chi: [URL he thong E-Path]",
    "Nhan nut 'Dang nhap' tren trang chu",
    "Nhap email cong ty (tai khoan)",
    "Nhap mat khau duoc cap",
    "Nhan 'Dang nhap' de vao he thong",
    "Lan dau dang nhap co the can xac thuc email",
])

# SLIDE 4: Giao dien chinh
add_content_slide(prs, "02. Giao dien Chinh - Dashboard", [
    {"text": "Thong tin tai khoan", "bold": True, "size": 18},
    "Hien thi o goc phai phia tren",
    "Bao gom: Ten, email, phong ban",
    "",
    {"text": "Thanh menu chinh (ben trai)", "bold": True, "size": 18},
    "Chuong trinh dao tao - Danh sach khoa hoc",
    "Bai hoc cua toi - Tien do ca nhan",
    "Bai kiem tra - Cac bai thi",
    "Yeu cau ho tro - Gui bao loi",
    "",
    {"text": "Noi dung chinh (giua man hinh)", "bold": True, "size": 18},
    "Tien do hoc tap tong quan",
    "Cac khoa hoc dang ky gan day",
    "Thong bao tu he thong",
], two_column=True)

# SLIDE 5: Chuong trinh dao tao
add_step_slide(prs, "03. Chuang trinh Dao tao", [
    "Tu menu ben trai, chon 'Chuong trinh dao tao'",
    "Xem danh sach tat ca khoa hoc hien co",
    "Nhan vao ten khoa hoc de xem chi tiet:",
    "   - Mo ta noi dung",
    "   - So bai hoc va thoi luong",
    "   - Giang vien huong dan",
    "Nhan nut 'Dang ky' de tham gia khoa hoc",
    "Khoa hoc duoc them vao 'Bai hoc cua toi'",
])

# SLIDE 6: Bai hoc va video
add_content_slide(prs, "04. Bai hoc va Video", [
    {"text": "Chon bai hoc", "bold": True, "size": 18},
    "Vao khoa hoc da dang ky",
    "Danh sach bai hoc hien thi theo thu tu",
    "",
    {"text": "Xem video bai giang", "bold": True, "size": 18},
    "Video phat o chinh giua man hinh",
    "Cac nut dieu khien: Play/Pause, Am luong, Toan man hinh",
    "Thanh tien trinh de tua nhanh",
    "",
    {"text": "Danh dau hoan thanh", "bold": True, "size": 18},
    "Sau khi xem xong, nhan 'Hoan thanh bai hoc'",
    "Co the xem lai video khong gioi han so lan",
    "",
    {"text": "Chuyen bai", "bold": True, "size": 18},
    "Nut 'Bai tiep theo' hoac tu dong chuyen",
], two_column=True)

# SLIDE 7: Tai lieu dinh kem
add_content_slide(prs, "05. Tai lieu Dinh kem", [
    {"text": "Tai lieu bai hoc", "bold": True, "size": 18},
    "Mot so bai hoc co tai lieu di kem",
    "Nut 'Tai tai lieu' nam duoi video",
    "",
    {"text": "Cac loai file ho tro", "bold": True, "size": 18},
    "PDF - Tai lieu dinh dang PDF",
    "Word (.doc, .docx) - Van ban",
    "Excel (.xls, .xlsx) - Bang tinh",
    "PowerPoint (.ppt, .pptx) - Trinh chieu",
    "",
    {"text": "Tai ve may", "bold": True, "size": 18},
    "Nhan vao file de tai ve may tinh",
    "Hoac xem truc tiep tren trinh duyet",
], two_column=True)

# SLIDE 8: Bai kiem tra
add_content_slide(prs, "06. Bai Kiem tra", [
    {"text": "Diem kiem tra", "bold": True, "size": 18},
    "Bat dau sau khi hoan thanh cac bai hoc",
    "Vao tu menu 'Bai kiem tra' hoac tu khoa hoc",
    "",
    {"text": "Thong tin bai thi", "bold": True, "size": 18},
    "So luong cau hoi",
    "Thoi gian lam bai (neu co gioi han)",
    "So lan duoc lam lai (neu cho phep)",
    "",
    {"text": "Lam bai", "bold": True, "size": 18},
    "Doc ky de bai va cau hoi",
    "Chon dap an dung cho moi cau",
    "Co the danh dau de xem lai",
    "Nhan 'Nop bai' khi hoan thanh",
    "",
    {"text": "Xem ket qua", "bold": True, "size": 18},
    "Hien thi diem so ngay sau khi nop",
    "Xem lai dap an dung/sai",
], two_column=True)

# SLIDE 9: Theo doi tien do
add_content_slide(prs, "07. Theo doi Tien do Hoc tap", [
    {"text": "Trang 'Bai hoc cua toi'", "bold": True, "size": 18},
    "Vao tu menu chinh ben trai",
    "Hien thi toan bo khoa hoc da dang ky",
    "",
    {"text": "Thong ke ca nhan", "bold": True, "size": 18},
    "Phan tram hoan thanh tung khoa",
    "So khoa da hoan thanh",
    "Bieu do tien do theo thoi gian",
    "",
    {"text": "Chi tiet khoa hoc", "bold": True, "size": 18},
    "So bai da hoc / Tong so bai",
    "Diem kiem tra cao nhat",
    "Ngay bat dau va ngay hoan thanh",
    "",
    {"text": "Chung chi", "bold": True, "size": 18},
    "Nhan chung chi khi hoan thanh 100% khoa",
    "Co the tai ve hoac chia se",
], two_column=True)

# SLIDE 10: Gui yeu cau ho tro
add_step_slide(prs, "08. Gui Yeu cau Ho tro", [
    "Vao menu 'Yeu cau ho tro'",
    "Nhan nut 'Tao yeu cau moi'",
    "Dien day du thong tin:",
    "   - Tieu de: Mo ta ngan gon van de",
    "   - Danh muc: Loai loi gap phai",
    "   - Muc do uu tien: Thap / Trung binh / Cao / Khan cap",
    "   - Mo ta chi tiet: Giai thich rõ van de",
    "   - Dinh kem anh neu can (chup man hinh loi)",
    "Nhan 'Gui yeu cau' de gui di",
    "Theo doi trang thai trong 'Yeu cau cua toi'",
])

# SLIDE 11: Trang thai yeu cau
add_table_slide(prs, "09. Trang thai Yeu cau Ho tro", 
    ["Trang thai", "Nghia", "Han dong"],
    [
        ["Moi", "Yeu cau vua duoc gui", "Cho duyet"],
        ["Dang xu ly", "Dang duoc xem xet", "Cho phan hoi"],
        ["Da giai quyet", "Da co loi giai", "Kiem tra"],
        ["Da dong", "Da hoan tat", "Dong yeu cau"],
    ])

# SLIDE 12: Thong tin lien he
add_content_slide(prs, "10. Thong tin Lien he Ho tro", [
    {"text": "Phong Nhan su - HR", "bold": True, "size": 18},
    "Ho tro ve: Dang ky khoa hoc, Chung chi",
    "Email: hr@company.com",
    "",
    {"text": "Phong CNTT - IT", "bold": True, "size": 18},
    "Ho tro ky thuat, Bao loi he thong",
    "Email: it-support@company.com",
    "",
    {"text": "Qua he thong E-Path", "bold": True, "size": 18},
    "Gui yeu cau truc tuyen 24/7",
    "Phan hoi trong gio lam viec",
    "",
    {"text": "Ghi chu quan trong", "bold": True, "size": 18},
    "Lien he som khi gap su co",
    "Cung cap anh chup man hinh loi",
    "Mo ta chi tiet cac buoc de tai hien loi",
])

# SLIDE 13: Ket thuc
add_end_slide(
    prs,
    "CAM ON",
    "Chuc cac ban hoc tap hieu qua!",
    "Lien he: hr@company.com | it-support@company.com"
)

# Luu file
output_path = "Slide_E-Path_Training_Chuan.pptx"
prs.save(output_path)
print(f"Da tao file: {output_path}")
print(f"Tong so slide: {len(prs.slides)}")
