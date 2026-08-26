"""
Script tạo PowerPoint hướng dẫn hệ thống E-Path Training
Cần cài đặt: pip install python-pptx
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.util import Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Tạo presentation mới
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Màu sắc (hex values)
BRAND_BLUE = "0066CC"
DARK_BLUE = "003366"
WHITE = "FFFFFF"
BLACK = "000000"
GRAY = "808080"

def hex_to_rgb(hex_color):
    """Convert hex to RGB tuple"""
    return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

def set_font_color(font, hex_color):
    """Set font color from hex"""
    from pptx.dml.color import RGBColor
    r, g, b = hex_to_rgb(hex_color)
    font.color.rgb = RGBColor(r, g, b)

def add_title_slide(prs, title, subtitle=""):
    """Slide tiêu đề chính"""
    slide_layout = prs.slide_layouts[6]  # Blank
    slide = prs.slides.add_slide(slide_layout)
    
    # Header bar
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(2.5)
    )
    shape.fill.solid()
    from pptx.dml.color import RGBColor
    shape.fill.fore_color.rgb = RGBColor(0, 102, 204)
    shape.line.fill.background()
    
    # Title
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.8), Inches(12), Inches(1.2))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(44)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)
    p.alignment = PP_ALIGN.CENTER
    
    # Subtitle
    if subtitle:
        txBox2 = slide.shapes.add_textbox(Inches(0.5), Inches(3), Inches(12), Inches(1))
        tf2 = txBox2.text_frame
        p2 = tf2.paragraphs[0]
        p2.text = subtitle
        p2.font.size = Pt(24)
        p2.font.color.rgb = RGBColor(0, 51, 102)
        p2.alignment = PP_ALIGN.CENTER
    
    return slide

def add_content_slide(prs, title, bullet_points):
    """Slide nội dung với bullet points"""
    from pptx.dml.color import RGBColor
    
    slide_layout = prs.slide_layouts[6]  # Blank
    slide = prs.slides.add_slide(slide_layout)
    
    # Header bar
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.2)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0, 102, 204)
    shape.line.fill.background()
    
    # Title
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(12), Inches(0.7))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)
    
    # Content area
    txBox2 = slide.shapes.add_textbox(Inches(0.7), Inches(1.5), Inches(12), Inches(5.5))
    tf2 = txBox2.text_frame
    tf2.word_wrap = True
    
    for i, point in enumerate(bullet_points):
        if i == 0:
            p = tf2.paragraphs[0]
        else:
            p = tf2.add_paragraph()
        
        # Xử lý bullet points
        if point.startswith("•") or point.startswith("-"):
            p.text = "  " + point
            p.level = 0
        elif point.startswith("  "):
            p.text = "    " + point.strip()
            p.level = 1
        else:
            p.text = "• " + point
            p.level = 0
        
        p.font.size = Pt(20)
        p.font.color.rgb = RGBColor(0, 0, 0)
        p.space_after = Pt(8)
    
    # Footer
    footer = slide.shapes.add_textbox(Inches(0.5), Inches(7), Inches(12), Inches(0.3))
    tf_footer = footer.text_frame
    p_footer = tf_footer.paragraphs[0]
    p_footer.text = "E-Path Training System"
    p_footer.font.size = Pt(12)
    p_footer.font.color.rgb = RGBColor(128, 128, 128)
    p_footer.alignment = PP_ALIGN.CENTER
    
    return slide

def add_two_column_slide(prs, title, left_content, right_content, left_title="", right_title=""):
    """Slide 2 cột"""
    from pptx.dml.color import RGBColor
    
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)
    
    # Header
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(1.2)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0, 102, 204)
    shape.line.fill.background()
    
    # Title
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(12), Inches(0.7))
    tf = txBox.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = RGBColor(255, 255, 255)
    
    # Left column title
    if left_title:
        txLeftTitle = slide.shapes.add_textbox(Inches(0.5), Inches(1.4), Inches(5.8), Inches(0.5))
        tfLeft = txLeftTitle.text_frame
        pLeft = tfLeft.paragraphs[0]
        pLeft.text = left_title
        pLeft.font.size = Pt(20)
        pLeft.font.bold = True
        pLeft.font.color.rgb = RGBColor(0, 102, 204)
    
    # Left content
    txLeft = slide.shapes.add_textbox(Inches(0.5), Inches(1.9), Inches(5.8), Inches(4.8))
    tfLeft = txLeft.text_frame
    tfLeft.word_wrap = True
    for i, point in enumerate(left_content):
        if i == 0:
            p = tfLeft.paragraphs[0]
        else:
            p = tfLeft.add_paragraph()
        p.text = "• " + point
        p.font.size = Pt(18)
        p.font.color.rgb = RGBColor(0, 0, 0)
        p.space_after = Pt(8)
    
    # Right column title
    if right_title:
        txRightTitle = slide.shapes.add_textbox(Inches(6.8), Inches(1.4), Inches(5.8), Inches(0.5))
        tfRight = txRightTitle.text_frame
        pRight = tfRight.paragraphs[0]
        pRight.text = right_title
        pRight.font.size = Pt(20)
        pRight.font.bold = True
        pRight.font.color.rgb = RGBColor(0, 102, 204)
    
    # Right content
    txRight = slide.shapes.add_textbox(Inches(6.8), Inches(1.9), Inches(5.8), Inches(4.8))
    tfRight = txRight.text_frame
    tfRight.word_wrap = True
    for i, point in enumerate(right_content):
        if i == 0:
            p = tfRight.paragraphs[0]
        else:
            p = tfRight.add_paragraph()
        p.text = "• " + point
        p.font.size = Pt(18)
        p.font.color.rgb = RGBColor(0, 0, 0)
        p.space_after = Pt(8)
    
    # Divider line
    line = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(6.5), Inches(1.5), Inches(0.02), Inches(5)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = RGBColor(128, 128, 128)
    line.line.fill.background()
    
    return slide

# ============ TẠO CÁC SLIDE ============

# SLIDE 1: Giới thiệu
add_title_slide(prs, "Hệ thống Đào tạo Trực tuyến", "E-Path Training System")
add_title_slide(prs, "E-Path", "Hướng dẫn sử dụng cho Nhân viên")

# SLIDE 2: Đăng nhập
add_content_slide(prs, "Đăng nhập Hệ thống", [
    "Truy cập địa chỉ: [URL hệ thống]",
    "Nhấn nút 'Đăng nhập'",
    "Sử dụng tài khoản email công ty",
    "Nhập mật khẩu được cấp",
    "Đăng nhập lần đầu có thể cần xác thực email",
    "",
    "Lưu ý:",
    "  - Nếu chưa có tài khoản, liên hệ phòng nhân sự",
    "  - Quên mật khẩu: Nhấn 'Quên mật khẩu' để reset",
])

# SLIDE 3: Giao diện chính
add_content_slide(prs, "Giao diện Chính - Dashboard", [
    "Hiển thị thông tin cá nhân ở góc phải trên",
    "Thanh menu chính bên trái:",
    "  - Chương trình đào tạo",
    "  - Bài học của tôi",
    "  - Bài kiểm tra",
    "  - Yêu cầu hỗ trợ",
    "Thống kê cá nhân:",
    "  - Tiến độ học tập",
    "  - Số khóa hoàn thành",
    "  - Bài kiểm tra đã làm",
    "Thông báo mới từ hệ thống",
])

# SLIDE 4: Chương trình đào tạo
add_content_slide(prs, "Chương trình Đào tạo", [
    "Vào mục 'Chương trình đào tạo' từ menu",
    "Xem danh sách các khóa học hiện có",
    "Thông tin mỗi khóa học:",
    "  - Tên khóa học",
    "  - Mô tả nội dung",
    "  - Thời lượng ước tính",
    "  - Số lượng bài học",
    "  - Trạng thái: Đã đăng ký / Chưa đăng ký",
    "Nhấn vào khóa học để xem chi tiết",
    "Nhấn 'Đăng ký' để tham gia khóa học",
])

# SLIDE 5: Bài học và Video
add_content_slide(prs, "Bài học - Xem Video", [
    "Chọn khóa học đã đăng ký",
    "Danh sách bài học hiển thị theo thứ tự",
    "Nhấn vào bài học để bắt đầu:",
    "  - Video bài giảng ở giữa màn hình",
    "  - Các nút điều khiển: Play/Pause, âm lượng, toàn màn hình",
    "  - Thanh tiến trình để tua video",
    "Đánh dấu hoàn thành sau khi xem xong",
    "Chuyển bài: Tự động hoặc nhấn 'Bài tiếp theo'",
    "",
    "Mẹo: Có thể xem lại video không giới hạn số lần",
])

# SLIDE 6: Tài liệu đính kèm
add_content_slide(prs, "Tài liệu Đính kèm", [
    "Mỗi bài học có thể có tài liệu đính kèm",
    "Nút 'Tải tài liệu' hiển thị dưới video",
    "Các loại file hỗ trợ:",
    "  - PDF",
    "  - Word (.doc, .docx)",
    "  - Excel (.xls, .xlsx)",
    "  - PowerPoint (.ppt, .pptx)",
    "Nhấn để tải về máy",
    "Một số tài liệu có thể xem trực tiếp trên trình duyệt",
])

# SLIDE 7: Bài kiểm tra
add_content_slide(prs, "Bài Kiểm tra", [
    "Sau khi hoàn thành bài học, có thể làm bài kiểm tra",
    "Vào mục 'Bài kiểm tra' hoặc nhấn từ khóa học",
    "Thông tin bài kiểm tra:",
    "  - Số câu hỏi",
    "  - Thời gian làm bài (nếu có giới hạn)",
    "  - Số lần được làm lại",
    "Làm bài:",
    "  - Chọn đáp án đúng cho mỗi câu hỏi",
    "  - Có thể đánh dấu câu chưa chắc",
    "Nộp bài và xem kết quả ngay",
])

# SLIDE 8: Theo dõi tiến độ
add_content_slide(prs, "Theo dõi Tiến độ Học tập", [
    "Vào mục 'Bài học của tôi' từ menu",
    "Dashboard tiến độ cá nhân:",
    "  - % hoàn thành mỗi khóa học",
    "  - Biểu đồ thống kê theo tuần/tháng",
    "  - Danh sách khóa học đã hoàn thành",
    "Chi tiết từng khóa:",
    "  - Số bài đã học / tổng số bài",
    "  - Điểm bài kiểm tra cao nhất",
    "  - Ngày hoàn thành",
    "Chứng chỉ: Nhận chứng chỉ khi hoàn thành 100% khóa học",
])

# SLIDE 9: Gửi yêu cầu hỗ trợ
add_content_slide(prs, "Gửi Yêu cầu Hỗ trợ", [
    "Khi gặp sự cố, vào mục 'Yêu cầu hỗ trợ'",
    "Nhấn 'Tạo yêu cầu mới'",
    "Điền thông tin:",
    "  - Tiêu đề: Mô tả ngắn gọn vấn đề",
    "  - Danh mục: Lỗi hệ thống / Lỗi video / Lỗi đăng nhập / ...",
    "  - Mức độ ưu tiên: Thấp / Trung bình / Cao / Khẩn cấp",
    "  - Mô tả chi tiết vấn đề",
    "  - Ảnh chụp màn hình (nếu có)",
    "Nhấn 'Gửi yêu cầu'",
    "Theo dõi trạng thái trong 'Yêu cầu của tôi'",
])

# SLIDE 10: Trạng thái yêu cầu
add_content_slide(prs, "Trạng thái Yêu cầu Hỗ trợ", [
    "Vào 'Yêu cầu hỗ trợ' > 'Yêu cầu của tôi'",
    "Các trạng thái:",
    "  - Mới: Yêu cầu vừa được gửi",
    "  - Đang xử lý: Đội kỹ thuật đang xem xét",
    "  - Đã giải quyết: Vấn đề đã được xử lý",
    "  - Đã đóng: Yêu cầu đã hoàn tất",
    "Xem chi tiết từng yêu cầu:",
    "  - Trạng thái hiện tại",
    "  - Ghi chú từ admin",
    "  - Thời gian xử lý",
    "Có thể xác nhận đóng yêu cầu khi đã được giải quyết",
])

# SLIDE 11: Các tính năng khác
add_two_column_slide(prs, "Tính năng Bổ sung",
    [
        "Nhận thông báo về khóa học mới",
        "Nhắc nhở bài học chưa hoàn thành",
        "Thông báo kết quả bài kiểm tra",
    ],
    [
        "Xem thông tin tài khoản",
        "Thay đổi thông tin cá nhân",
        "Đăng xuất khi cần",
    ],
    "Thông báo", "Hồ sơ cá nhân"
)

# SLIDE 12: Mẹo sử dụng
add_content_slide(prs, "Mẹo sử dụng Hiệu quả", [
    "Lên lịch học tập:",
    "  - Dành 30-60 phút mỗi ngày",
    "  - Học vào thời gian ít bị gián đoạn",
    "Ghi chú khi học:",
    "  - Ghi lại các điểm quan trọng",
    "  - Đánh dấu phần cần xem lại",
    "Làm bài kiểm tra:",
    "  - Đọc kỹ đề bài trước khi trả lời",
    "  - Kiểm tra lại trước khi nộp",
    "Liên hệ hỗ trợ kịp thời khi gặp sự cố",
])

# SLIDE 13: Xử lý sự cố
add_content_slide(prs, "Xử lý Sự cố Thường gặp", [
    "Video không phát được:",
    "  - Kiểm tra kết nối internet",
    "  - Xóa cache trình duyệt, thử trình duyệt khác",
    "Không đăng nhập được:",
    "  - Kiểm tra lại email và mật khẩu",
    "  - Nhấn 'Quên mật khẩu' hoặc liên hệ IT",
    "Bài kiểm tra mất kết quả:",
    "  - Không tắt tab khi đang làm bài",
    "  - Thử làm lại nếu còn lượt",
    "Tài liệu không tải được:",
    "  - Kiểm tra quyền truy cập",
])

# SLIDE 14: Thông tin liên hệ
add_content_slide(prs, "Thông tin Liên hệ Hỗ trợ", [
    "Phòng Nhân sự - HR:",
    "  - Hỗ trợ về đăng ký khóa học",
    "  - Thông tin chứng chỉ",
    "Phòng IT:",
    "  - Hỗ trợ kỹ thuật",
    "  - Báo lỗi hệ thống",
    "",
    "Email hỗ trợ: [email@company.com]",
    "",
    "Nội bộ: Gửi yêu cầu qua hệ thống E-Path",
])

# SLIDE 15: Kết luận
add_title_slide(prs, "Bắt đầu Học tập Ngay!", 
    "E-Path luôn sẵn sàng hỗ trợ bạn\nHãy đầu tư thời gian để phát triển bản thân!")

# Lưu file
output_path = "Slide_Huong_Dan_E-Path_Training.pptx"
prs.save(output_path)
print(f"Da tao file: {output_path}")
print(f"Tong so slide: {len(prs.slides)}")
