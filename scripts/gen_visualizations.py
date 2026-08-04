"""
Tạo các hình visualize đẹp cho tài liệu hướng dẫn Epath
Xuất ra file PNG, sau đó nhúng vào Word.
"""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle, Circle
from matplotlib.lines import Line2D
import os
import numpy as np

# Tạo thư mục assets
ASSET_DIR = "D:/LP & EP IT/EpathSystemTraining/docs_assets"
os.makedirs(ASSET_DIR, exist_ok=True)

# ─── Style chung ─────────────────────────────────────────────
PRIMARY = "#1E40AF"      # Xanh dương đậm
PRIMARY_LIGHT = "#3B82F6"
SECONDARY = "#7C3AED"    # Tím
SUCCESS = "#10B981"      # Xanh lá
WARNING = "#F59E0B"      # Vàng
DANGER = "#EF4444"       # Đỏ
GRAY_50 = "#F9FAFB"
GRAY_100 = "#F3F4F6"
GRAY_200 = "#E5E7EB"
GRAY_400 = "#9CA3AF"
GRAY_600 = "#4B5563"
GRAY_800 = "#1F2937"
DARK_BG = "#0F172A"
ACCENT_LIGHT = "#DBEAFE"

# Font hỗ trợ tiếng Việt - dùng font có sẵn
plt.rcParams['font.family'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


def save_fig(fig, name, dpi=150):
    """Lưu figure"""
    path = os.path.join(ASSET_DIR, f"{name}.png")
    fig.savefig(path, dpi=dpi, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close(fig)
    print(f"  [OK] {name}.png")
    return path


# ═══════════════════════════════════════════════════════════════
# 1. SƠ ĐỒ TỔNG QUAN HỆ THỐNG
# ═══════════════════════════════════════════════════════════════
def fig_overview():
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Title bar
    title_box = FancyBboxPatch((1, 5.5), 10, 1, boxstyle="round,pad=0.1",
                                 facecolor=DARK_BG, edgecolor=PRIMARY, linewidth=2)
    ax.add_patch(title_box)
    ax.text(6, 6, 'HỆ THỐNG ĐÀO TẠO EPATH', ha='center', va='center',
            fontsize=18, color='white', fontweight='bold')
    ax.text(6, 5.7, 'Epath System Training', ha='center', va='center',
            fontsize=10, color='#94C5FF', style='italic')

    # Cột NHÂN VIÊN
    nv_box = FancyBboxPatch((0.5, 1.5), 4.5, 3.5, boxstyle="round,pad=0.1",
                            facecolor='white', edgecolor=PRIMARY, linewidth=2.5)
    ax.add_patch(nv_box)
    ax.text(2.75, 4.5, 'NHÂN VIÊN', ha='center', va='center',
            fontsize=15, color=PRIMARY, fontweight='bold')
    ax.text(2.75, 4.1, '👥', ha='center', va='center', fontsize=24)

    items_nv = [
        ("Học bài giảng", "📚"),
        ("Làm bài kiểm tra", "✍️"),
        ("Xem tiến độ", "📊"),
    ]
    for i, (txt, icon) in enumerate(items_nv):
        y = 3.4 - i * 0.7
        item_box = FancyBboxPatch((0.9, y - 0.25), 3.7, 0.5, boxstyle="round,pad=0.05",
                                   facecolor=ACCENT_LIGHT, edgecolor=PRIMARY_LIGHT, linewidth=0.8)
        ax.add_patch(item_box)
        ax.text(1.15, y, icon, ha='center', va='center', fontsize=14)
        ax.text(1.6, y, txt, ha='left', va='center', fontsize=11, color=GRAY_800)

    # Cột ADMIN
    ad_box = FancyBboxPatch((7, 1.5), 4.5, 3.5, boxstyle="round,pad=0.1",
                            facecolor='white', edgecolor=SECONDARY, linewidth=2.5)
    ax.add_patch(ad_box)
    ax.text(9.25, 4.5, 'QUẢN TRỊ VIÊN', ha='center', va='center',
            fontsize=15, color=SECONDARY, fontweight='bold')
    ax.text(9.25, 4.1, '🛡️', ha='center', va='center', fontsize=24)

    items_ad = [
        ("Tạo chương trình", "📋"),
        ("Gán nhân viên", "👤"),
        ("Xem báo cáo", "📈"),
    ]
    for i, (txt, icon) in enumerate(items_ad):
        y = 3.4 - i * 0.7
        item_box = FancyBboxPatch((7.4, y - 0.25), 3.7, 0.5, boxstyle="round,pad=0.05",
                                   facecolor="#EDE9FE", edgecolor=SECONDARY, linewidth=0.8)
        ax.add_patch(item_box)
        ax.text(7.65, y, icon, ha='center', va='center', fontsize=14)
        ax.text(8.1, y, txt, ha='left', va='center', fontsize=11, color=GRAY_800)

    # Đường kết nối từ title xuống 2 cột
    ax.plot([6, 2.75], [5.5, 5.0], color=PRIMARY, linewidth=2, alpha=0.5)
    ax.plot([6, 9.25], [5.5, 5.0], color=SECONDARY, linewidth=2, alpha=0.5)

    # Icon ở giữa
    ax.text(6, 2.5, '🤝', ha='center', va='center', fontsize=30)
    ax.text(6, 1.7, 'Cùng phát triển', ha='center', va='center',
            fontsize=10, color=GRAY_600, style='italic')

    ax.text(6, 0.3, 'Hình 1.1: Hai vai trò chính trong hệ thống Epath',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_1_overview")


# ═══════════════════════════════════════════════════════════════
# 2. MÀN HÌNH DASHBOARD
# ═══════════════════════════════════════════════════════════════
def fig_dashboard():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Browser frame
    browser = FancyBboxPatch((0.2, 0.2), 11.6, 7.6, boxstyle="round,pad=0.05",
                             facecolor='white', edgecolor=GRAY_400, linewidth=1.5)
    ax.add_patch(browser)

    # Header bar
    header = Rectangle((0.2, 7.1), 11.6, 0.7, facecolor=DARK_BG, edgecolor='none')
    ax.add_patch(header)
    # URL bar
    url_bar = FancyBboxPatch((0.6, 7.2), 11, 0.4, boxstyle="round,pad=0.02",
                             facecolor=GRAY_800, edgecolor='none')
    ax.add_patch(url_bar)
    ax.text(0.9, 7.4, '🔒', ha='center', va='center', fontsize=10, color=GRAY_400)
    ax.text(1.2, 7.4, 'https://training.epath.com/dashboard', ha='left', va='center',
            fontsize=9, color=GRAY_400, family='monospace')
    # Dots
    for i, c in enumerate(['#FF5F57', '#FEBC2E', '#28C840']):
        ax.add_patch(Circle((0.4 + i * 0.2, 7.4), 0.08, facecolor=c, edgecolor='none'))

    # Welcome message
    ax.text(0.7, 6.6, 'Xin chào, Nguyễn Văn A!', ha='left', va='center',
            fontsize=18, fontweight='bold', color=GRAY_800)
    ax.text(0.7, 6.25, 'Các chương trình đã được admin gán cho bạn',
            ha='left', va='center', fontsize=10, color=GRAY_600, style='italic')

    # 3 Stat cards
    stats = [
        ("Chương trình được gán", "3", "#3B82F6", "📚"),
        ("Đang học", "2", "#F59E0B", "⏰"),
        ("Hoàn thành", "1", "#10B981", "✅"),
    ]
    for i, (label, value, color, icon) in enumerate(stats):
        x = 0.7 + i * 3.7
        card = FancyBboxPatch((x, 4.7), 3.4, 1.3, boxstyle="round,pad=0.05",
                              facecolor='white', edgecolor=GRAY_200, linewidth=1)
        ax.add_patch(card)
        # Icon box
        icon_box = FancyBboxPatch((x + 0.2, 5.2), 0.7, 0.6, boxstyle="round,pad=0.05",
                                   facecolor=color + '20', edgecolor='none')
        ax.add_patch(icon_box)
        ax.text(x + 0.55, 5.5, icon, ha='center', va='center', fontsize=18)
        # Text
        ax.text(x + 1.05, 5.6, label, ha='left', va='center', fontsize=9, color=GRAY_600)
        ax.text(x + 1.05, 5.1, value, ha='left', va='center', fontsize=22,
                fontweight='bold', color=color)

    # Main content card
    main_card = FancyBboxPatch((0.7, 0.7), 7.6, 3.7, boxstyle="round,pad=0.05",
                                facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(main_card)
    ax.text(1.0, 4.1, 'Chương trình của tôi', ha='left', va='center',
            fontsize=13, fontweight='bold', color=GRAY_800)
    ax.text(7.5, 4.1, 'Xem tất cả →', ha='right', va='center',
            fontsize=10, color=PRIMARY, fontweight='bold')

    # 2 program items
    programs = [
        ("An toàn lao động", "Hoàn thành", 100, SUCCESS, "✅"),
        ("Quy trình bán hàng", "Đang học", 30, WARNING, "▶"),
    ]
    for i, (title, status, pct, color, icon) in enumerate(programs):
        y = 3.4 - i * 1.1
        # Card
        item = FancyBboxPatch((1.0, y - 0.4), 7.0, 0.85, boxstyle="round,pad=0.03",
                               facecolor=GRAY_50, edgecolor=GRAY_200, linewidth=0.8)
        ax.add_patch(item)
        # Thumbnail
        thumb = FancyBboxPatch((1.15, y - 0.3), 0.9, 0.65, boxstyle="round,pad=0.02",
                                facecolor=PRIMARY + '20', edgecolor='none')
        ax.add_patch(thumb)
        ax.text(1.6, y, '📖', ha='center', va='center', fontsize=22)
        # Title
        ax.text(2.2, y + 0.2, title, ha='left', va='center', fontsize=11,
                fontweight='bold', color=GRAY_800)
        # Progress bar
        bar_bg = FancyBboxPatch((2.2, y - 0.05), 3.0, 0.18, boxstyle="round,pad=0.01",
                                 facecolor=GRAY_200, edgecolor='none')
        ax.add_patch(bar_bg)
        if pct > 0:
            bar_fill = FancyBboxPatch((2.2, y - 0.05), 3.0 * pct / 100, 0.18, boxstyle="round,pad=0.01",
                                       facecolor=color, edgecolor='none')
            ax.add_patch(bar_fill)
        ax.text(2.2, y - 0.25, f'{pct}% hoàn thành', ha='left', va='center',
                fontsize=8, color=GRAY_600)
        # Status badge
        badge = FancyBboxPatch((6.5, y - 0.15), 1.3, 0.3, boxstyle="round,pad=0.02",
                                facecolor=color + '20', edgecolor=color, linewidth=0.8)
        ax.add_patch(badge)
        ax.text(7.15, y, status, ha='center', va='center', fontsize=9,
                color=color, fontweight='bold')

    # Sidebar
    sidebar = FancyBboxPatch((8.5, 0.7), 3.0, 3.7, boxstyle="round,pad=0.05",
                              facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(sidebar)
    ax.text(8.7, 4.1, 'Tổng quan', ha='left', va='center',
            fontsize=12, fontweight='bold', color=GRAY_800)
    # Progress
    ax.text(8.7, 3.6, 'Tiến độ trung bình', ha='left', va='center', fontsize=9, color=GRAY_600)
    ax.text(11.3, 3.6, '65%', ha='right', va='center', fontsize=9, fontweight='bold', color=PRIMARY)
    bar_bg2 = FancyBboxPatch((8.7, 3.4), 2.7, 0.15, boxstyle="round,pad=0.01",
                              facecolor=GRAY_200, edgecolor='none')
    ax.add_patch(bar_bg2)
    bar_fill2 = FancyBboxPatch((8.7, 3.4), 2.7 * 0.65, 0.15, boxstyle="round,pad=0.01",
                                facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(bar_fill2)

    # Quick actions
    ax.text(8.7, 2.7, 'Thao tác nhanh', ha='left', va='center',
            fontsize=11, fontweight='bold', color=GRAY_800)
    actions = [("📚 Tất cả chương trình", 2.2), ("📊 Tiến độ của tôi", 1.5)]
    for txt, y in actions:
        btn = FancyBboxPatch((8.7, y - 0.2), 2.7, 0.4, boxstyle="round,pad=0.02",
                              facecolor='white', edgecolor=GRAY_200, linewidth=0.8)
        ax.add_patch(btn)
        ax.text(8.85, y, txt, ha='left', va='center', fontsize=9, color=GRAY_800)
        ax.text(11.2, y, '›', ha='center', va='center', fontsize=14, color=GRAY_600)

    ax.text(6, -0.05, 'Hình 2.1: Giao diện Trang chủ (Dashboard)',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic', transform=ax.transData)
    return save_fig(fig, "fig_2_dashboard")


# ═══════════════════════════════════════════════════════════════
# 3. DANH SÁCH CHƯƠNG TRÌNH
# ═══════════════════════════════════════════════════════════════
def fig_programs_list():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Title
    ax.text(0.5, 6.5, 'Chương trình của tôi', ha='left', va='center',
            fontsize=18, fontweight='bold', color=GRAY_800)
    ax.text(0.5, 6.15, 'Xin chào Nguyễn Văn A!', ha='left', va='center',
            fontsize=10, color=GRAY_600, style='italic')

    # Đang học section
    ax.text(0.5, 5.5, '▼ Đang học (2)', ha='left', va='center',
            fontsize=13, fontweight='bold', color=WARNING)

    # Card 1
    c1 = FancyBboxPatch((0.5, 3.6), 5.5, 1.7, boxstyle="round,pad=0.05",
                        facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(c1)
    # Thumbnail
    t1 = FancyBboxPatch((0.7, 3.8), 1.4, 1.3, boxstyle="round,pad=0.02",
                        facecolor=PRIMARY + '15', edgecolor='none')
    ax.add_patch(t1)
    ax.text(1.4, 4.45, '📚', ha='center', va='center', fontsize=40)
    # Title
    ax.text(2.3, 4.9, 'Quy trình bán hàng', ha='left', va='center',
            fontsize=12, fontweight='bold', color=GRAY_800)
    # Status
    badge1 = FancyBboxPatch((4.7, 4.7), 1.1, 0.3, boxstyle="round,pad=0.02",
                             facecolor=WARNING + '20', edgecolor=WARNING, linewidth=0.8)
    ax.add_patch(badge1)
    ax.text(5.25, 4.85, 'Đang học', ha='center', va='center', fontsize=8.5,
            color=WARNING, fontweight='bold')
    # Description
    ax.text(2.3, 4.5, 'Quy trình chuẩn từ tiếp cận đến chốt đơn', ha='left', va='center',
            fontsize=9, color=GRAY_600)
    # Progress
    ax.text(2.3, 4.0, '3/10 bài học', ha='left', va='center', fontsize=8, color=GRAY_600)
    ax.text(5.85, 4.0, '30%', ha='right', va='center', fontsize=8, fontweight='bold', color=WARNING)
    bar1 = FancyBboxPatch((2.3, 3.75), 3.55, 0.15, boxstyle="round,pad=0.01",
                          facecolor=GRAY_200, edgecolor='none')
    ax.add_patch(bar1)
    bar1f = FancyBboxPatch((2.3, 3.75), 3.55 * 0.3, 0.15, boxstyle="round,pad=0.01",
                            facecolor=WARNING, edgecolor='none')
    ax.add_patch(bar1f)
    # Button
    btn1 = FancyBboxPatch((4.3, 3.4), 1.5, 0.3, boxstyle="round,pad=0.02",
                            facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn1)
    ax.text(5.05, 3.55, '▶ Tiếp tục', ha='center', va='center', fontsize=9,
            color='white', fontweight='bold')

    # Card 2
    c2 = FancyBboxPatch((6.2, 3.6), 5.5, 1.7, boxstyle="round,pad=0.05",
                        facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(c2)
    t2 = FancyBboxPatch((6.4, 3.8), 1.4, 1.3, boxstyle="round,pad=0.02",
                        facecolor=PRIMARY + '15', edgecolor='none')
    ax.add_patch(t2)
    ax.text(7.1, 4.45, '📖', ha='center', va='center', fontsize=40)
    ax.text(8.0, 4.9, 'Kỹ năng giao tiếp', ha='left', va='center',
            fontsize=12, fontweight='bold', color=GRAY_800)
    badge2 = FancyBboxPatch((10.4, 4.7), 1.2, 0.3, boxstyle="round,pad=0.02",
                             facecolor=GRAY_400 + '20', edgecolor=GRAY_400, linewidth=0.8)
    ax.add_patch(badge2)
    ax.text(11.0, 4.85, 'Chưa bắt đầu', ha='center', va='center', fontsize=8,
            color=GRAY_600, fontweight='bold')
    ax.text(8.0, 4.5, 'Nâng cao kỹ năng giao tiếp hiệu quả', ha='left', va='center',
            fontsize=9, color=GRAY_600)
    ax.text(8.0, 4.0, '0/8 bài học', ha='left', va='center', fontsize=8, color=GRAY_600)
    ax.text(11.55, 4.0, '0%', ha='right', va='center', fontsize=8, fontweight='bold', color=GRAY_600)
    bar2 = FancyBboxPatch((8.0, 3.75), 3.55, 0.15, boxstyle="round,pad=0.01",
                          facecolor=GRAY_200, edgecolor='none')
    ax.add_patch(bar2)
    btn2 = FancyBboxPatch((9.9, 3.4), 1.6, 0.3, boxstyle="round,pad=0.02",
                            facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn2)
    ax.text(10.7, 3.55, '▶ Bắt đầu học', ha='center', va='center', fontsize=9,
            color='white', fontweight='bold')

    # Đã hoàn thành section
    ax.text(0.5, 2.7, '▼ Đã hoàn thành (1)', ha='left', va='center',
            fontsize=13, fontweight='bold', color=SUCCESS)

    # Card 3
    c3 = FancyBboxPatch((0.5, 0.8), 5.5, 1.7, boxstyle="round,pad=0.05",
                        facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(c3)
    t3 = FancyBboxPatch((0.7, 1.0), 1.4, 1.3, boxstyle="round,pad=0.02",
                        facecolor=SUCCESS + '20', edgecolor='none')
    ax.add_patch(t3)
    ax.text(1.4, 1.65, '✅', ha='center', va='center', fontsize=40)
    ax.text(2.3, 2.1, 'An toàn lao động', ha='left', va='center',
            fontsize=12, fontweight='bold', color=GRAY_800)
    badge3 = FancyBboxPatch((4.7, 1.9), 1.1, 0.3, boxstyle="round,pad=0.02",
                             facecolor=SUCCESS + '20', edgecolor=SUCCESS, linewidth=0.8)
    ax.add_patch(badge3)
    ax.text(5.25, 2.05, 'Hoàn thành', ha='center', va='center', fontsize=8.5,
            color=SUCCESS, fontweight='bold')
    ax.text(2.3, 1.65, 'Các quy tắc an toàn tại nơi làm việc', ha='left', va='center',
            fontsize=9, color=GRAY_600)
    ax.text(2.3, 1.2, '5/5 bài học', ha='left', va='center', fontsize=8, color=GRAY_600)
    ax.text(5.85, 1.2, '100%', ha='right', va='center', fontsize=8, fontweight='bold', color=SUCCESS)
    bar3 = FancyBboxPatch((2.3, 0.95), 3.55, 0.15, boxstyle="round,pad=0.01",
                          facecolor=GRAY_200, edgecolor='none')
    ax.add_patch(bar3)
    bar3f = FancyBboxPatch((2.3, 0.95), 3.55, 0.15, boxstyle="round,pad=0.01",
                            facecolor=SUCCESS, edgecolor='none')
    ax.add_patch(bar3f)

    ax.text(6, 0.1, 'Hình 2.2: Trang Chương trình của tôi (chia 2 nhóm)',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_3_programs_list")


# ═══════════════════════════════════════════════════════════════
# 4. VIDEO PLAYER
# ═══════════════════════════════════════════════════════════════
def fig_video_player():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Title
    ax.text(0.5, 6.5, 'Bài 3: Tình huống thực tế', ha='left', va='center',
            fontsize=16, fontweight='bold', color=GRAY_800)
    ax.text(0.5, 6.15, 'Chương trình: Quy trình bán hàng', ha='left', va='center',
            fontsize=10, color=GRAY_600, style='italic')

    # Video frame
    vid = FancyBboxPatch((0.5, 2.3), 8.5, 3.6, boxstyle="round,pad=0.05",
                         facecolor='#1F2937', edgecolor=GRAY_800, linewidth=2)
    ax.add_patch(vid)

    # Play button (center)
    play_circle = Circle((4.75, 4.1), 0.55, facecolor='white', edgecolor='none', alpha=0.95)
    ax.add_patch(play_circle)
    triangle = plt.Polygon([(4.6, 3.85), (4.6, 4.35), (5.05, 4.1)], color=PRIMARY)
    ax.add_patch(triangle)

    # Video time
    ax.text(0.8, 2.7, '⏱  05:30 / 12:00', ha='left', va='center',
            fontsize=11, color='white', family='monospace')

    # Progress bar
    bar_bg = FancyBboxPatch((0.8, 2.5), 8.0, 0.12, boxstyle="round,pad=0.01",
                            facecolor=GRAY_600, edgecolor='none')
    ax.add_patch(bar_bg)
    bar_fill = FancyBboxPatch((0.8, 2.5), 8.0 * 0.458, 0.12, boxstyle="round,pad=0.01",
                               facecolor=PRIMARY_LIGHT, edgecolor='none')
    ax.add_patch(bar_fill)
    knob = Circle((0.8 + 8.0 * 0.458, 2.56), 0.08, facecolor='white', edgecolor=PRIMARY)
    ax.add_patch(knob)

    # Video controls
    ctrls = ['⏯', '⏮', '⏭', '🔊', '⛶', '⚙']
    for i, c in enumerate(ctrls):
        ax.text(7.8 + i * 0.25, 2.4, c, ha='center', va='center', fontsize=11, color='white')

    # Description
    desc_card = FancyBboxPatch((0.5, 0.5), 8.5, 1.5, boxstyle="round,pad=0.05",
                                facecolor=GRAY_50, edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(desc_card)
    ax.text(0.8, 1.7, 'Mô tả bài học', ha='left', va='center',
            fontsize=11, fontweight='bold', color=GRAY_800)
    desc_text = "Trong bài này, chúng ta sẽ tìm hiểu các tình huống thực tế\nthường gặp khi tư vấn khách hàng và cách xử lý hiệu quả."
    ax.text(0.8, 1.2, desc_text, ha='left', va='center', fontsize=9, color=GRAY_600)

    # Sidebar
    side = FancyBboxPatch((9.2, 0.5), 2.5, 5.8, boxstyle="round,pad=0.05",
                          facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(side)
    ax.text(9.4, 6.0, 'Danh sách bài học', ha='left', va='center',
            fontsize=11, fontweight='bold', color=GRAY_800)

    lessons = [
        ("Bài 1: Giới thiệu", "done", SUCCESS),
        ("Bài 2: Quy trình", "done", SUCCESS),
        ("Bài 3: Tình huống", "active", WARNING),
        ("Bài 4: Bài kiểm tra", "locked", GRAY_400),
    ]
    for i, (txt, state, color) in enumerate(lessons):
        y = 5.3 - i * 0.8
        item = FancyBboxPatch((9.3, y - 0.3), 2.3, 0.6, boxstyle="round,pad=0.02",
                              facecolor=(color + '15' if state != 'locked' else GRAY_50),
                              edgecolor=color, linewidth=0.8)
        ax.add_patch(item)
        icon = "✓" if state == "done" else ("▶" if state == "active" else "🔒")
        ax.text(9.5, y, icon, ha='center', va='center', fontsize=12, color=color)
        ax.text(9.8, y, txt, ha='left', va='center', fontsize=8.5, color=GRAY_800)

    # Navigation buttons
    btn_p = FancyBboxPatch((0.5, 0.0), 1.5, 0.4, boxstyle="round,pad=0.02",
                           facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(btn_p)
    ax.text(1.25, 0.2, '← Bài trước', ha='center', va='center', fontsize=9, color=GRAY_800)

    btn_done = FancyBboxPatch((3.5, 0.0), 2.0, 0.4, boxstyle="round,pad=0.02",
                              facecolor='white', edgecolor=PRIMARY, linewidth=1.5)
    ax.add_patch(btn_done)
    ax.text(4.5, 0.2, '✓ Đánh dấu hoàn thành', ha='center', va='center', fontsize=9,
            color=PRIMARY, fontweight='bold')

    btn_n = FancyBboxPatch((7.5, 0.0), 1.5, 0.4, boxstyle="round,pad=0.02",
                           facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn_n)
    ax.text(8.25, 0.2, 'Bài tiếp →', ha='center', va='center', fontsize=9,
            color='white', fontweight='bold')

    ax.text(6, -0.4, 'Hình 2.3: Giao diện xem video bài học',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_4_video_player")


# ═══════════════════════════════════════════════════════════════
# 5. BÀI KIỂM TRA
# ═══════════════════════════════════════════════════════════════
def fig_quiz():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Title
    ax.text(0.5, 6.5, 'Bài kiểm tra: An toàn lao động', ha='left', va='center',
            fontsize=16, fontweight='bold', color=GRAY_800)
    ax.text(8.5, 6.5, '⏱  Còn lại: 08:32', ha='right', va='center',
            fontsize=11, color=DANGER, fontweight='bold')

    # Progress dots
    ax.text(0.5, 5.95, 'Câu 3 / 10', ha='left', va='center',
            fontsize=11, color=GRAY_600, fontweight='bold')
    # 10 dots, 3 done, 1 current
    for i in range(10):
        x = 0.5 + 5.5 + i * 0.55
        if i < 2:
            color = SUCCESS
        elif i == 2:
            color = PRIMARY
        else:
            color = GRAY_200
        c = Circle((x, 5.95), 0.15, facecolor=color, edgecolor='none')
        ax.add_patch(c)

    # Question card
    qc = FancyBboxPatch((0.5, 2.5), 11, 3.0, boxstyle="round,pad=0.05",
                        facecolor='white', edgecolor=GRAY_200, linewidth=1.5)
    ax.add_patch(qc)

    # Question icon
    ax.text(0.8, 4.8, '❓', ha='center', va='center', fontsize=22)
    ax.text(1.3, 5.05, 'Câu 3', ha='left', va='center',
            fontsize=11, color=GRAY_600, fontweight='bold')
    ax.text(1.3, 4.65, 'Khi gặp sự cố cháy, bạn cần làm gì đầu tiên?',
            ha='left', va='center', fontsize=13, color=GRAY_800, fontweight='bold')

    # Options
    options = [
        ("A", "Hoảng loạn bỏ chạy", False),
        ("B", "Bình tĩnh, gọi cứu hỏ, dùng bình chữa cháy", True),
        ("C", "Chụp ảnh đăng mạng xã hội", False),
        ("D", "Đợi người khác xử lý", False),
    ]
    for i, (letter, txt, selected) in enumerate(options):
        y = 4.0 - i * 0.4
        opt_box = FancyBboxPatch((0.9, y - 0.15), 10.3, 0.35, boxstyle="round,pad=0.02",
                                  facecolor=(PRIMARY_LIGHT + '20' if selected else 'white'),
                                  edgecolor=(PRIMARY if selected else GRAY_200),
                                  linewidth=(2 if selected else 0.8))
        ax.add_patch(opt_box)
        # Radio
        radio = Circle((1.2, y), 0.13, facecolor='white', edgecolor=PRIMARY if selected else GRAY_400,
                       linewidth=1.5)
        ax.add_patch(radio)
        if selected:
            inner = Circle((1.2, y), 0.07, facecolor=PRIMARY, edgecolor='none')
            ax.add_patch(inner)
        ax.text(1.5, y, letter, ha='center', va='center', fontsize=11,
                fontweight='bold', color=PRIMARY if selected else GRAY_800)
        ax.text(2.0, y, txt, ha='left', va='center', fontsize=11,
                color=GRAY_800, fontweight=('bold' if selected else 'normal'))

    # Buttons
    btn_prev = FancyBboxPatch((0.5, 1.5), 1.5, 0.4, boxstyle="round,pad=0.02",
                              facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(btn_prev)
    ax.text(1.25, 1.7, '← Câu trước', ha='center', va='center', fontsize=10, color=GRAY_800)

    btn_next = FancyBboxPatch((10.0, 1.5), 1.5, 0.4, boxstyle="round,pad=0.02",
                              facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn_next)
    ax.text(10.75, 1.7, 'Câu tiếp →', ha='center', va='center', fontsize=10,
            color='white', fontweight='bold')

    # Bottom bar
    ax.text(0.5, 1.0, '💡 Mẹo: Câu trả lời đã được lưu tự động', ha='left', va='center',
            fontsize=9, color=GRAY_600, style='italic')

    ax.text(6, 0.2, 'Hình 2.4: Giao diện làm bài kiểm tra trắc nghiệm',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_5_quiz")


# ═══════════════════════════════════════════════════════════════
# 6. KẾT QUẢ BÀI THI
# ═══════════════════════════════════════════════════════════════
def fig_quiz_result():
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Result banner
    banner = FancyBboxPatch((1, 4.5), 10, 2, boxstyle="round,pad=0.1",
                            facecolor=SUCCESS, edgecolor='none')
    ax.add_patch(banner)
    ax.text(6, 5.8, '🎉 CHÚC MỪNG!', ha='center', va='center',
            fontsize=22, color='white', fontweight='bold')
    ax.text(6, 5.3, 'Bạn đã ĐẠT bài kiểm tra', ha='center', va='center',
            fontsize=14, color='white')
    ax.text(6, 4.85, 'Điểm: 80/100', ha='center', va='center',
            fontsize=20, color='white', fontweight='bold')

    # Stats boxes
    stats = [
        ("✓ 8/10", "Câu đúng", SUCCESS),
        ("✗ 2/10", "Câu sai", DANGER),
        ("🎯 80%", "Tỷ lệ đạt", PRIMARY),
        ("⏱ 12:45", "Thời gian", SECONDARY),
    ]
    for i, (val, label, color) in enumerate(stats):
        x = 0.5 + i * 3.0
        box = FancyBboxPatch((x, 2.5), 2.7, 1.5, boxstyle="round,pad=0.05",
                             facecolor='white', edgecolor=color, linewidth=2)
        ax.add_patch(box)
        ax.text(x + 1.35, 3.3, val, ha='center', va='center',
                fontsize=22, color=color, fontweight='bold')
        ax.text(x + 1.35, 2.8, label, ha='center', va='center',
                fontsize=11, color=GRAY_600)

    # Action buttons
    btn1 = FancyBboxPatch((2.5, 1.0), 2.5, 0.5, boxstyle="round,pad=0.02",
                           facecolor='white', edgecolor=PRIMARY, linewidth=1.5)
    ax.add_patch(btn1)
    ax.text(3.75, 1.25, '👁 Xem chi tiết', ha='center', va='center', fontsize=11,
            color=PRIMARY, fontweight='bold')

    btn2 = FancyBboxPatch((5.5, 1.0), 2.5, 0.5, boxstyle="round,pad=0.02",
                           facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn2)
    ax.text(6.75, 1.25, '🔄 Làm lại', ha='center', va='center', fontsize=11,
            color='white', fontweight='bold')

    btn3 = FancyBboxPatch((8.5, 1.0), 2.0, 0.5, boxstyle="round,pad=0.02",
                           facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(btn3)
    ax.text(9.5, 1.25, 'Đóng', ha='center', va='center', fontsize=11, color=GRAY_800)

    ax.text(6, 0.3, 'Hình 2.5: Kết quả bài kiểm tra sau khi nộp',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_6_quiz_result")


# ═══════════════════════════════════════════════════════════════
# 7. HỒ SƠ CÁ NHÂN
# ═══════════════════════════════════════════════════════════════
def fig_profile():
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Avatar
    av = Circle((1.5, 5.5), 0.7, facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(av)
    ax.text(1.5, 5.5, '👤', ha='center', va='center', fontsize=30)

    # Info
    ax.text(2.6, 5.95, 'Nguyễn Văn A', ha='left', va='center',
            fontsize=18, fontweight='bold', color=GRAY_800)
    ax.text(2.6, 5.6, '📧 nguyenvana@congty.com', ha='left', va='center',
            fontsize=10, color=GRAY_600)
    ax.text(2.6, 5.3, '🏢 Phòng Kinh doanh', ha='left', va='center',
            fontsize=10, color=GRAY_600)

    # Stats
    stats = [
        ("📚 5", "Tổng CT", PRIMARY),
        ("✅ 3", "Hoàn thành", SUCCESS),
        ("🏆 85", "Điểm TB", WARNING),
        ("⏱ 42h", "Đã học", SECONDARY),
    ]
    for i, (val, label, color) in enumerate(stats):
        x = 0.5 + i * 2.95
        box = FancyBboxPatch((x, 3.5), 2.7, 1.4, boxstyle="round,pad=0.05",
                             facecolor='white', edgecolor=color, linewidth=2)
        ax.add_patch(box)
        ax.text(x + 1.35, 4.3, val, ha='center', va='center',
                fontsize=22, color=color, fontweight='bold')
        ax.text(x + 1.35, 3.8, label, ha='center', va='center',
                fontsize=11, color=GRAY_600)

    # Programs list
    title_bg = FancyBboxPatch((0.5, 2.6), 11, 0.4, boxstyle="round,pad=0.02",
                              facecolor=DARK_BG, edgecolor='none')
    ax.add_patch(title_bg)
    ax.text(0.8, 2.8, '📚 Chương trình của tôi', ha='left', va='center',
            fontsize=12, color='white', fontweight='bold')

    programs = [
        ("An toàn lao động", 100, SUCCESS),
        ("Quy trình bán hàng", 50, WARNING),
        ("Kỹ năng giao tiếp", 100, SUCCESS),
        ("Excel nâng cao", 25, WARNING),
    ]
    for i, (name, pct, color) in enumerate(programs):
        y = 2.2 - i * 0.42
        name_bg = FancyBboxPatch((0.5, y - 0.15), 4.5, 0.32, boxstyle="round,pad=0.02",
                                  facecolor=GRAY_50, edgecolor='none')
        ax.add_patch(name_bg)
        ax.text(0.7, y, name, ha='left', va='center', fontsize=10, color=GRAY_800)
        # Bar
        bar_bg = FancyBboxPatch((5.2, y - 0.05), 4.5, 0.12, boxstyle="round,pad=0.01",
                                facecolor=GRAY_200, edgecolor='none')
        ax.add_patch(bar_bg)
        if pct > 0:
            bar_fill = FancyBboxPatch((5.2, y - 0.05), 4.5 * pct / 100, 0.12, boxstyle="round,pad=0.01",
                                       facecolor=color, edgecolor='none')
            ax.add_patch(bar_fill)
        ax.text(10.5, y, f'{pct}%', ha='right', va='center', fontsize=10,
                fontweight='bold', color=color)

    ax.text(6, 0.1, 'Hình 2.6: Trang hồ sơ cá nhân và tiến độ học tập',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_7_profile")


# ═══════════════════════════════════════════════════════════════
# 8. FORM TẠO CHƯƠNG TRÌNH
# ═══════════════════════════════════════════════════════════════
def fig_create_program():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Header
    hdr = FancyBboxPatch((0.5, 6.5), 11, 1, boxstyle="round,pad=0.05",
                         facecolor=DARK_BG, edgecolor='none')
    ax.add_patch(hdr)
    ax.text(0.8, 7.0, '➕ Tạo chương trình mới', ha='left', va='center',
            fontsize=16, color='white', fontweight='bold')

    # Form
    form = FancyBboxPatch((0.5, 0.5), 11, 5.5, boxstyle="round,pad=0.05",
                          facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(form)

    # Tên chương trình *
    ax.text(0.8, 5.5, 'Tên chương trình *', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    inp = FancyBboxPatch((0.8, 4.8), 10.4, 0.5, boxstyle="round,pad=0.02",
                          facecolor=GRAY_50, edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(inp)
    ax.text(1.0, 5.05, 'An toàn lao động', ha='left', va='center',
            fontsize=11, color=GRAY_800)

    # Mô tả
    ax.text(0.8, 4.4, 'Mô tả', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    inp2 = FancyBboxPatch((0.8, 3.4), 10.4, 0.8, boxstyle="round,pad=0.02",
                           facecolor=GRAY_50, edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(inp2)
    ax.text(1.0, 3.9, 'Khóa học về các quy tắc an toàn tại nơi làm việc, bao gồm PCCC, sơ cứu...',
            ha='left', va='top', fontsize=10, color=GRAY_600)

    # Ảnh bìa
    ax.text(0.8, 3.0, 'Ảnh bìa', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    up = FancyBboxPatch((0.8, 2.2), 3.5, 0.6, boxstyle="round,pad=0.02",
                        facecolor=ACCENT_LIGHT, edgecolor=PRIMARY, linewidth=1.5,
                        linestyle='--')
    ax.add_patch(up)
    ax.text(2.55, 2.5, '📷  Chọn ảnh từ máy', ha='center', va='center',
            fontsize=11, color=PRIMARY, fontweight='bold')

    # Trình độ & Trạng thái
    ax.text(4.7, 3.0, 'Trình độ', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    sel1 = FancyBboxPatch((4.7, 2.2), 3.0, 0.5, boxstyle="round,pad=0.02",
                           facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(sel1)
    ax.text(4.9, 2.45, 'Cơ bản', ha='left', va='center', fontsize=11, color=GRAY_800)
    ax.text(7.5, 2.45, '▾', ha='center', va='center', fontsize=11, color=GRAY_600)

    ax.text(8.0, 3.0, 'Trạng thái', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    sel2 = FancyBboxPatch((8.0, 2.2), 3.2, 0.5, boxstyle="round,pad=0.02",
                           facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(sel2)
    ax.text(8.2, 2.45, 'Đã xuất bản', ha='left', va='center', fontsize=11, color=GRAY_800)
    ax.text(11.0, 2.45, '▾', ha='center', va='center', fontsize=11, color=GRAY_600)

    # Buttons
    btn_cancel = FancyBboxPatch((7.5, 0.8), 1.5, 0.5, boxstyle="round,pad=0.02",
                                 facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(btn_cancel)
    ax.text(8.25, 1.05, 'Hủy', ha='center', va='center', fontsize=11, color=GRAY_800)

    btn_save = FancyBboxPatch((9.3, 0.8), 2.0, 0.5, boxstyle="round,pad=0.02",
                               facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn_save)
    ax.text(10.3, 1.05, '💾  Lưu', ha='center', va='center', fontsize=11,
            color='white', fontweight='bold')

    ax.text(6, 0.0, 'Hình 3.1: Form tạo chương trình đào tạo mới',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_8_create_program")


# ═══════════════════════════════════════════════════════════════
# 9. GÁN CHƯƠNG TRÌNH
# ═══════════════════════════════════════════════════════════════
def fig_assign_program():
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Header
    hdr = FancyBboxPatch((0.5, 6.3), 11, 0.6, boxstyle="round,pad=0.05",
                         facecolor=DARK_BG, edgecolor='none')
    ax.add_patch(hdr)
    ax.text(0.8, 6.6, '👤 Gán chương trình cho nhân viên', ha='left', va='center',
            fontsize=14, color='white', fontweight='bold')

    # Chọn chương trình
    ax.text(0.5, 5.7, 'Chọn chương trình', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    sel = FancyBboxPatch((0.5, 5.0), 11, 0.5, boxstyle="round,pad=0.02",
                          facecolor='white', edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(sel)
    ax.text(0.7, 5.25, 'An toàn lao động', ha='left', va='center', fontsize=11, color=GRAY_800)
    ax.text(11.3, 5.25, '▾', ha='center', va='center', fontsize=11, color=GRAY_600)

    # 2 cột: cá nhân / nhóm
    # Cột 1: Cá nhân
    ax.text(0.5, 4.5, 'Cách 1: Gán theo cá nhân', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    cb = FancyBboxPatch((0.5, 1.0), 5.3, 3.3, boxstyle="round,pad=0.05",
                        facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(cb)
    # Search
    search = FancyBboxPatch((0.7, 3.85), 4.9, 0.4, boxstyle="round,pad=0.02",
                             facecolor=GRAY_50, edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(search)
    ax.text(0.85, 4.05, '🔍 Tìm kiếm nhân viên...', ha='left', va='center',
            fontsize=9, color=GRAY_400)

    users = [
        ("Nguyễn Văn A", True),
        ("Trần Thị B", True),
        ("Lê Văn C", False),
        ("Phạm Thị D", False),
    ]
    for i, (name, checked) in enumerate(users):
        y = 3.4 - i * 0.5
        # Checkbox
        box = FancyBboxPatch((0.7, y - 0.1), 0.18, 0.18, boxstyle="round,pad=0.01",
                              facecolor=(PRIMARY if checked else 'white'),
                              edgecolor=PRIMARY if checked else GRAY_400, linewidth=1.5)
        ax.add_patch(box)
        if checked:
            ax.text(0.79, y - 0.01, '✓', ha='center', va='center', fontsize=10,
                    color='white', fontweight='bold')
        # Avatar
        av = Circle((1.1, y - 0.01), 0.18, facecolor=PRIMARY_LIGHT, edgecolor='none')
        ax.add_patch(av)
        ax.text(1.1, y - 0.01, '👤', ha='center', va='center', fontsize=11)
        ax.text(1.4, y, name, ha='left', va='center', fontsize=10, color=GRAY_800)

    # Cột 2: Nhóm
    ax.text(6.2, 4.5, 'Cách 2: Gán theo nhóm', ha='left', va='center',
            fontsize=11, color=GRAY_800, fontweight='bold')
    cb2 = FancyBboxPatch((6.2, 1.0), 5.3, 3.3, boxstyle="round,pad=0.05",
                         facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(cb2)

    groups = [
        ("Phòng Kinh doanh (15 người)", True),
        ("Phòng Kỹ thuật (8 người)", True),
        ("Phòng Hành chính (5 người)", False),
        ("Phòng Marketing (6 người)", False),
    ]
    for i, (name, checked) in enumerate(groups):
        y = 3.4 - i * 0.5
        box = FancyBboxPatch((6.4, y - 0.1), 0.18, 0.18, boxstyle="round,pad=0.01",
                              facecolor=(PRIMARY if checked else 'white'),
                              edgecolor=PRIMARY if checked else GRAY_400, linewidth=1.5)
        ax.add_patch(box)
        if checked:
            ax.text(6.49, y - 0.01, '✓', ha='center', va='center', fontsize=10,
                    color='white', fontweight='bold')
        ax.text(6.8, y, '👥', ha='center', va='center', fontsize=11)
        ax.text(7.1, y, name, ha='left', va='center', fontsize=10, color=GRAY_800)

    # Deadline
    ax.text(0.5, 0.7, '📅 Hạn hoàn thành (tùy chọn):  30/12/2026', ha='left', va='center',
            fontsize=10, color=GRAY_800)

    # Action button
    btn = FancyBboxPatch((9.5, 0.7), 2.0, 0.5, boxstyle="round,pad=0.02",
                          facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn)
    ax.text(10.5, 0.95, '✓ Gán', ha='center', va='center', fontsize=12,
            color='white', fontweight='bold')

    ax.text(6, 0.0, 'Hình 3.2: Giao diện gán chương trình cho nhân viên',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_9_assign")


# ═══════════════════════════════════════════════════════════════
# 10. DASHBOARD ADMIN
# ═══════════════════════════════════════════════════════════════
def fig_admin_dashboard():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Header
    ax.text(0.5, 6.5, '📊 Báo cáo Tổng quan', ha='left', va='center',
            fontsize=18, fontweight='bold', color=GRAY_800)
    ax.text(0.5, 6.15, 'Cập nhật: 31/07/2026', ha='left', va='center',
            fontsize=10, color=GRAY_600, style='italic')

    # 4 KPI cards
    kpis = [
        ("👥", "150", "Nhân viên", PRIMARY),
        ("📚", "12", "Chương trình", SUCCESS),
        ("📖", "156", "Bài học", WARNING),
        ("📈", "78%", "Hoàn thành TB", SECONDARY),
    ]
    for i, (icon, val, label, color) in enumerate(kpis):
        x = 0.5 + i * 2.95
        card = FancyBboxPatch((x, 4.7), 2.7, 1.3, boxstyle="round,pad=0.05",
                              facecolor='white', edgecolor=color, linewidth=2)
        ax.add_patch(card)
        ax.text(x + 0.4, 5.55, icon, ha='center', va='center', fontsize=20)
        ax.text(x + 1.5, 5.7, val, ha='center', va='center',
                fontsize=20, color=color, fontweight='bold')
        ax.text(x + 1.5, 5.05, val, ha='center', va='center',
                fontsize=20, color=color, fontweight='bold')
        ax.text(x + 1.35, 4.9, label, ha='center', va='center',
                fontsize=10, color=GRAY_600)

    # Bar chart - top chương trình
    ax.text(0.5, 4.3, '📈 Top 5 chương trình có tỷ lệ hoàn thành cao',
            ha='left', va='center', fontsize=12, fontweight='bold', color=GRAY_800)

    programs = [
        ("An toàn lao động", 95, SUCCESS),
        ("Kỹ năng giao tiếp", 88, SUCCESS),
        ("Quy trình bán hàng", 75, WARNING),
        ("Excel nâng cao", 60, WARNING),
        ("Quản lý thời gian", 45, DANGER),
    ]
    chart_box = FancyBboxPatch((0.5, 0.5), 11, 3.7, boxstyle="round,pad=0.05",
                                facecolor='white', edgecolor=GRAY_200, linewidth=1)
    ax.add_patch(chart_box)

    max_pct = 100
    for i, (name, pct, color) in enumerate(programs):
        y = 3.5 - i * 0.6
        ax.text(0.8, y, name, ha='left', va='center', fontsize=10, color=GRAY_800)
        # Bar
        bar_w = 7.5 * pct / max_pct
        bar_bg = FancyBboxPatch((3.5, y - 0.15), 7.5, 0.3, boxstyle="round,pad=0.02",
                                facecolor=GRAY_50, edgecolor='none')
        ax.add_patch(bar_bg)
        bar_fill = FancyBboxPatch((3.5, y - 0.15), bar_w, 0.3, boxstyle="round,pad=0.02",
                                   facecolor=color, edgecolor='none')
        ax.add_patch(bar_fill)
        # Value
        ax.text(11.2, y, f'{pct}%', ha='right', va='center', fontsize=10,
                fontweight='bold', color=color)

    ax.text(6, 0.0, 'Hình 3.3: Báo cáo tổng quan dành cho Admin',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_10_admin_dashboard")


# ═══════════════════════════════════════════════════════════════
# 11. FLOW ĐĂNG NHẬP
# ═══════════════════════════════════════════════════════════════
def fig_login_flow():
    fig, ax = plt.subplots(figsize=(11, 4))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 4)
    ax.axis('off')

    ax.text(7, 3.5, 'Quy trình đăng nhập', ha='center', va='center',
            fontsize=14, fontweight='bold', color=GRAY_800)

    steps = [
        ("1. Mở trình duyệt", "🌐", PRIMARY),
        ("2. Nhập Email\n& Mật khẩu", "🔑", PRIMARY),
        ("3. Nhấn\nĐăng nhập", "🔘", PRIMARY),
        ("4. Vào Trang chủ", "🏠", SUCCESS),
    ]
    for i, (txt, icon, color) in enumerate(steps):
        x = 0.8 + i * 3.3
        # Box
        box = FancyBboxPatch((x, 1.5), 2.8, 1.5, boxstyle="round,pad=0.05",
                              facecolor='white', edgecolor=color, linewidth=2)
        ax.add_patch(box)
        # Icon
        ax.text(x + 1.4, 2.5, icon, ha='center', va='center', fontsize=28)
        ax.text(x + 1.4, 1.85, txt, ha='center', va='center', fontsize=9,
                color=GRAY_800, fontweight='bold')
        # Arrow
        if i < 3:
            ax.annotate('', xy=(x + 3.2, 2.25), xytext=(x + 2.85, 2.25),
                        arrowprops=dict(arrowstyle='->', color=GRAY_400, lw=2))

    ax.text(7, 0.5, 'Hình 2.0: 4 bước đăng nhập vào hệ thống',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_11_login_flow")


# ═══════════════════════════════════════════════════════════════
# 12. FLOW HỌC BÀI
# ═══════════════════════════════════════════════════════════════
def fig_learning_flow():
    fig, ax = plt.subplots(figsize=(11, 4.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 5)
    ax.axis('off')

    ax.text(7, 4.5, 'Quy trình học một chương trình', ha='center', va='center',
            fontsize=14, fontweight='bold', color=GRAY_800)

    steps = [
        ("Chọn chương\ntrình", "📚", PRIMARY),
        ("Xem danh sách\nbài học", "📋", PRIMARY),
        ("Học từng bài\n(video/tài liệu)", "▶", PRIMARY),
        ("Làm bài kiểm\ntra (nếu có)", "✍️", WARNING),
        ("Hoàn thành\n100% ✅", "🎉", SUCCESS),
    ]
    for i, (txt, icon, color) in enumerate(steps):
        x = 0.5 + i * 2.7
        # Box
        box = FancyBboxPatch((x, 1.8), 2.4, 1.7, boxstyle="round,pad=0.05",
                              facecolor='white', edgecolor=color, linewidth=2)
        ax.add_patch(box)
        # Icon
        ax.text(x + 1.2, 2.85, icon, ha='center', va='center', fontsize=26)
        ax.text(x + 1.2, 2.1, txt, ha='center', va='center', fontsize=9,
                color=GRAY_800, fontweight='bold')
        # Arrow
        if i < 4:
            ax.annotate('', xy=(x + 2.6, 2.65), xytext=(x + 2.45, 2.65),
                        arrowprops=dict(arrowstyle='->', color=GRAY_400, lw=2))

    # Loop arrow
    ax.annotate('', xy=(0.5, 1.2), xytext=(13.0, 1.2),
                arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0.2',
                                color=PRIMARY, lw=1.5, linestyle='--'))
    ax.text(7, 0.7, 'Tiếp tục với chương trình tiếp theo', ha='center', va='center',
            fontsize=10, color=PRIMARY, style='italic')

    ax.text(7, 0.1, 'Hình 2.7: Quy trình học tập trong hệ thống',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_12_learning_flow")


# ═══════════════════════════════════════════════════════════════
# 13. TRANG ĐĂNG NHẬP
# ═══════════════════════════════════════════════════════════════
def fig_login_page():
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis('off')

    # Background gradient
    bg = Rectangle((0, 0), 10, 7, facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(bg)

    # Left side - branding
    ax.text(2.5, 5.5, 'EPATH', ha='center', va='center',
            fontsize=36, color='white', fontweight='bold')
    ax.text(2.5, 4.8, 'Hệ thống Đào tạo Nội bộ', ha='center', va='center',
            fontsize=14, color='white', style='italic')
    ax.text(2.5, 4.2, 'Học tập mọi lúc mọi nơi', ha='center', va='center',
            fontsize=11, color='#94C5FF')

    # Right side - login form
    form = FancyBboxPatch((5.5, 1.2), 4.0, 5.0, boxstyle="round,pad=0.1",
                          facecolor='white', edgecolor='none')
    ax.add_patch(form)

    ax.text(7.5, 5.7, 'Đăng nhập', ha='center', va='center',
            fontsize=18, color=GRAY_800, fontweight='bold')
    ax.text(7.5, 5.35, 'Chào mừng bạn quay lại!', ha='center', va='center',
            fontsize=10, color=GRAY_600)

    # Email
    ax.text(5.8, 4.7, 'Email', ha='left', va='center',
            fontsize=10, color=GRAY_800, fontweight='bold')
    email_inp = FancyBboxPatch((5.8, 4.1), 3.4, 0.5, boxstyle="round,pad=0.02",
                                facecolor=GRAY_50, edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(email_inp)
    ax.text(6.0, 4.35, 'tenban@congty.com', ha='left', va='center',
            fontsize=10, color=GRAY_600)

    # Password
    ax.text(5.8, 3.7, 'Mật khẩu', ha='left', va='center',
            fontsize=10, color=GRAY_800, fontweight='bold')
    pass_inp = FancyBboxPatch((5.8, 3.1), 3.4, 0.5, boxstyle="round,pad=0.02",
                               facecolor=GRAY_50, edgecolor=GRAY_400, linewidth=1)
    ax.add_patch(pass_inp)
    ax.text(6.0, 3.35, '••••••••', ha='left', va='center',
            fontsize=14, color=GRAY_800)
    ax.text(8.9, 3.35, '👁', ha='center', va='center', fontsize=10, color=GRAY_600)

    # Forgot
    ax.text(9.2, 2.7, 'Quên mật khẩu?', ha='right', va='center',
            fontsize=9, color=PRIMARY, fontweight='bold')

    # Login button
    btn = FancyBboxPatch((5.8, 1.9), 3.4, 0.5, boxstyle="round,pad=0.02",
                          facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(btn)
    ax.text(7.5, 2.15, '🔒  Đăng nhập', ha='center', va='center',
            fontsize=12, color='white', fontweight='bold')

    ax.text(7.5, 1.5, 'Chưa có tài khoản? Liên hệ IT', ha='center', va='center',
            fontsize=9, color=GRAY_600)

    ax.text(5, 0.3, 'Hình 2.0: Trang đăng nhập hệ thống',
            ha='center', va='center', fontsize=10, color='white', style='italic')
    return save_fig(fig, "fig_13_login_page")


# ═══════════════════════════════════════════════════════════════
# 14. DANH SÁCH BÀI HỌC
# ═══════════════════════════════════════════════════════════════
def fig_lesson_list():
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')

    ax.text(0.5, 6.5, 'Chương trình: Quy trình bán hàng', ha='left', va='center',
            fontsize=16, fontweight='bold', color=GRAY_800)
    ax.text(0.5, 6.15, 'Tổng: 10 bài học  •  Hoàn thành: 2/10  •  20%',
            ha='left', va='center', fontsize=10, color=GRAY_600)

    # Progress bar
    bg = FancyBboxPatch((0.5, 5.5), 11, 0.3, boxstyle="round,pad=0.02",
                         facecolor=GRAY_200, edgecolor='none')
    ax.add_patch(bg)
    fill = FancyBboxPatch((0.5, 5.5), 11 * 0.2, 0.3, boxstyle="round,pad=0.02",
                           facecolor=PRIMARY, edgecolor='none')
    ax.add_patch(fill)

    lessons = [
        ("Bài 1", "Giới thiệu chương trình", "5:00", "done", SUCCESS, "✓"),
        ("Bài 2", "Quy trình tiếp cận khách hàng", "12:00", "done", SUCCESS, "✓"),
        ("Bài 3", "Phân tích nhu cầu", "15:00", "active", WARNING, "▶"),
        ("Bài 4", "Tư vấn sản phẩm", "18:00", "locked", GRAY_400, "🔒"),
        ("Bài 5", "Xử lý từ chối", "10:00", "locked", GRAY_400, "🔒"),
        ("Bài 6", "Bài kiểm tra cuối khóa", "20:00", "locked", GRAY_400, "🔒"),
    ]
    for i, (num, title, duration, state, color, icon) in enumerate(lessons):
        y = 4.5 - i * 0.6
        # Lesson card
        bg_card = FancyBboxPatch((0.5, y - 0.25), 11, 0.5, boxstyle="round,pad=0.02",
                                  facecolor=('white' if state != 'locked' else GRAY_50),
                                  edgecolor=(color if state != 'locked' else GRAY_200),
                                  linewidth=(1.5 if state == 'active' else 0.8))
        ax.add_patch(bg_card)

        # Number circle
        nc = Circle((0.9, y), 0.22, facecolor=color, edgecolor='none')
        ax.add_patch(nc)
        ax.text(0.9, y, icon, ha='center', va='center', fontsize=11,
                color='white', fontweight='bold')

        # Title
        ax.text(1.3, y, title, ha='left', va='center', fontsize=11,
                color=(GRAY_800 if state != 'locked' else GRAY_400),
                fontweight=('bold' if state == 'active' else 'normal'))

        # Duration
        ax.text(8.5, y, f'⏱ {duration}', ha='left', va='center',
                fontsize=9, color=GRAY_600)

        # Status
        if state == 'done':
            badge_t = "Đã hoàn thành"
        elif state == 'active':
            badge_t = "Đang học"
        else:
            badge_t = "Chưa mở"
        badge = FancyBboxPatch((9.8, y - 0.1), 1.5, 0.22, boxstyle="round,pad=0.01",
                                facecolor=color + '20', edgecolor=color, linewidth=0.6)
        ax.add_patch(badge)
        ax.text(10.55, y, badge_t, ha='center', va='center', fontsize=8,
                color=color, fontweight='bold')

    ax.text(6, 0.1, 'Hình 2.3: Danh sách bài học trong chương trình',
            ha='center', va='center', fontsize=10, color=GRAY_600, style='italic')
    return save_fig(fig, "fig_14_lesson_list")


# ═══════════════════════════════════════════════════════════════
# CHẠY TẤT CẢ
# ═══════════════════════════════════════════════════════════════
print("=" * 60)
print("Dang tao cac hinh visualize...")
print("=" * 60)

fig_overview()
fig_dashboard()
fig_programs_list()
fig_lesson_list()
fig_video_player()
fig_quiz()
fig_quiz_result()
fig_profile()
fig_create_program()
fig_assign_program()
fig_admin_dashboard()
fig_login_flow()
fig_learning_flow()
fig_login_page() # Für Login Page

print("=" * 60)
print(f"Hoan tat! Da tao {len(os.listdir(ASSET_DIR))} hinh trong {ASSET_DIR}")
print("=" * 60)
