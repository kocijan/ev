import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Output directory
IMG_DIR = os.path.abspath("assets/img")
os.makedirs(IMG_DIR, exist_ok=True)

FONT_BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BLACK_PATH = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

def create_glow_circle(size, inner_color, outer_color, radius):
    """Creates a smooth radial glow circle."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size / 2.0
    for r in range(int(radius), 0, -1):
        t = r / radius
        alpha = int((1.0 - t) * (1.0 - t) * outer_color[3])
        color = (
            int(inner_color[0] * (1 - t) + outer_color[0] * t),
            int(inner_color[1] * (1 - t) + outer_color[1] * t),
            int(inner_color[2] * (1 - t) + outer_color[2] * t),
            alpha
        )
        draw.ellipse([center - r, center - r, center + r, center + r], fill=color)
    return img

def draw_vector_stopwatch(draw, x, y, size, color):
    """Draws a crisp vector stopwatch icon."""
    r = size / 2.0
    cx = x + r
    cy = y + r
    stroke = max(2, int(size * 0.11))
    # Clock circle
    draw.ellipse([cx - r * 0.8, cy - r * 0.8, cx + r * 0.8, cy + r * 0.8], outline=color, width=stroke)
    # Top pin & button
    draw.line([(cx, cy - r * 0.8), (cx, cy - r * 1.05)], fill=color, width=stroke)
    draw.line([(cx - r * 0.3, cy - r * 1.05), (cx + r * 0.3, cy - r * 1.05)], fill=color, width=stroke)
    # Right side 45 deg button
    bx = cx + r * 0.65
    by = cy - r * 0.65
    draw.line([(bx, by), (bx + r * 0.2, by - r * 0.2)], fill=color, width=stroke)
    # Clock hands
    draw.line([(cx, cy), (cx, cy - r * 0.5)], fill=color, width=stroke)
    draw.line([(cx, cy), (cx + r * 0.38, cy)], fill=color, width=stroke)

def draw_vector_spinner(draw, cx, cy, radius, color):
    """Draws an animated-style circular arc spinner."""
    stroke = max(2, int(radius * 0.32))
    draw.arc([cx - radius, cy - radius, cx + radius, cy + radius], start=45, end=315, fill=color, width=stroke)
    # Small dot at tip
    dot_r = stroke / 2.0
    rad = math.radians(45)
    dx = cx + radius * math.cos(rad)
    dy = cy + radius * math.sin(rad)
    draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=color)

def render_og_image(width=1200, height=630, is_16_9=False):
    scale = 2
    W = width * scale
    H = height * scale

    base = Image.new("RGBA", (W, H), (10, 15, 30, 255))
    draw = ImageDraw.Draw(base)

    # Vertical gradient: dark navy/slate to pitch black
    for y in range(H):
        t = y / float(H)
        r = int(12 * (1 - t * 0.65))
        g = int(18 * (1 - t * 0.7))
        b = int(36 * (1 - t * 0.75))
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Ambient glows
    # Cyan electric glow bottom left
    glow_cyan = create_glow_circle(int(900 * scale), (0, 230, 160, 40), (0, 150, 200, 0), int(420 * scale))
    base.alpha_composite(glow_cyan, (int(-250 * scale), int(H - 420 * scale)))

    # Red starting halo behind lights
    glow_red = create_glow_circle(int(1000 * scale), (255, 30, 60, 75), (200, 0, 40, 0), int(450 * scale))
    base.alpha_composite(glow_red, (int(W / 2 - 500 * scale), int(15 * scale)))

    # Subtle tech grid lines
    grid_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid_overlay)
    grid_spacing = 45 * scale
    for x in range(0, W, grid_spacing):
        grid_draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 6), width=1)
    for y in range(0, H, grid_spacing):
        grid_draw.line([(0, y), (W, y)], fill=(255, 255, 255, 6), width=1)
    base.alpha_composite(grid_overlay)

    # Subtle Croatian checkerboard ribbon motif in top right corner
    cb_size = int(14 * scale)
    for row in range(3):
        for col in range(6):
            if (row + col) % 2 == 0:
                color = (235, 30, 50, 35) # Red
            else:
                color = (255, 255, 255, 35) # White
            rx = W - (6 - col) * cb_size - int(24 * scale)
            ry = int(24 * scale) + row * cb_size
            grid_draw.rectangle([rx, ry, rx + cb_size, ry + cb_size], fill=color)
    base.alpha_composite(grid_overlay)

    draw = ImageDraw.Draw(base)

    # Fonts
    font_badge = ImageFont.truetype(FONT_BOLD_PATH, int(15 * scale))
    font_title1 = ImageFont.truetype(FONT_BLACK_PATH, int(43 * scale))
    font_title2 = ImageFont.truetype(FONT_BLACK_PATH, int(43 * scale))
    font_sub = ImageFont.truetype(FONT_BOLD_PATH, int(20 * scale))
    font_chip = ImageFont.truetype(FONT_BOLD_PATH, int(14 * scale))
    font_status = ImageFont.truetype(FONT_BOLD_PATH, int(14.5 * scale))
    font_timer_num = ImageFont.truetype(FONT_BLACK_PATH, int(28 * scale))
    font_timer_lbl = ImageFont.truetype(FONT_BOLD_PATH, int(11.5 * scale))

    # ---------------------------------------------------- TOP BADGE
    badge_label = "NESLUŽBENI SIMULATOR · JAVNI POZIV EnU-2/26"
    badge_bbox = font_badge.getbbox(badge_label)
    bw = badge_bbox[2] - badge_bbox[0]
    bh = badge_bbox[3] - badge_bbox[1]
    
    dot_dia = int(8 * scale)
    badge_content_w = dot_dia + int(10 * scale) + bw
    badge_x = int((W - badge_content_w) / 2)
    badge_y = int(30 * scale)

    pad_x = int(20 * scale)
    pad_y = int(7 * scale)
    draw.rounded_rectangle(
        [badge_x - pad_x, badge_y - pad_y, badge_x + badge_content_w + pad_x, badge_y + bh + pad_y + 2],
        radius=int(14 * scale),
        fill=(18, 26, 44, 230),
        outline=(255, 175, 20, 160),
        width=int(1.5 * scale)
    )

    # Glowing orange dot
    dot_y = badge_y + int((bh - dot_dia) / 2)
    draw.ellipse([badge_x, dot_y, badge_x + dot_dia, dot_y + dot_dia], fill=(255, 180, 30, 255))
    draw.text((badge_x + dot_dia + int(10 * scale), badge_y - 1), badge_label, font=font_badge, fill=(255, 195, 65, 255))

    # ---------------------------------------------------- F1 LIGHTS GANTRY
    gantry_y = int(78 * scale)
    num_pods = 5
    pod_w = int(72 * scale)
    pod_h = int(148 * scale)
    pod_gap = int(22 * scale)
    total_gantry_w = num_pods * pod_w + (num_pods - 1) * pod_gap
    gantry_start_x = int((W - total_gantry_w) / 2)

    # Horizontal mounting backboard beam
    beam_h = int(14 * scale)
    beam_y = gantry_y + int(pod_h / 2 - beam_h / 2)
    draw.rounded_rectangle(
        [gantry_start_x - int(24 * scale), beam_y, gantry_start_x + total_gantry_w + int(24 * scale), beam_y + beam_h],
        radius=int(4 * scale),
        fill=(8, 8, 12, 255),
        outline=(50, 55, 72, 255),
        width=int(1 * scale)
    )

    # Light pods
    lamp_dia = int(26 * scale)
    lamp_spacing = int(7 * scale)

    for i in range(num_pods):
        px = gantry_start_x + i * (pod_w + pod_gap)
        py = gantry_y

        # Pod casing
        draw.rounded_rectangle(
            [px, py, px + pod_w, py + pod_h],
            radius=int(16 * scale),
            fill=(13, 13, 17, 255),
            outline=(60, 66, 82, 255),
            width=int(1.5 * scale)
        )
        # Inner beveled border
        draw.rounded_rectangle(
            [px + int(2 * scale), py + int(2 * scale), px + pod_w - int(2 * scale), py + pod_h - int(2 * scale)],
            radius=int(14 * scale),
            outline=(24, 26, 34, 255),
            width=int(1 * scale)
        )

        lamps_total_h = 4 * lamp_dia + 3 * lamp_spacing
        lamp_start_y = py + int((pod_h - lamps_total_h) / 2)
        lamp_x = px + int((pod_w - lamp_dia) / 2)

        for l_idx in range(4):
            ly = lamp_start_y + l_idx * (lamp_dia + lamp_spacing)
            cx = lamp_x + lamp_dia / 2.0
            cy = ly + lamp_dia / 2.0
            r = lamp_dia / 2.0

            if l_idx < 2:
                # UNLIT (Top two lamps: dark graphite glass with bevel)
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(22, 22, 26, 255), outline=(40, 42, 50, 255), width=int(1 * scale))
                inner_r = r * 0.72
                draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(15, 15, 18, 255))
            else:
                # LIT RED LED (Bottom two lamps: vivid F1 red with glowing halo)
                halo = create_glow_circle(int(100 * scale), (255, 30, 45, 120), (255, 0, 30, 0), int(46 * scale))
                base.alpha_composite(halo, (int(cx - 50 * scale), int(cy - 50 * scale)))

                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(235, 12, 42, 255), outline=(255, 95, 115, 255), width=int(1.5 * scale))
                r_mid = r * 0.65
                draw.ellipse([cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid], fill=(255, 65, 85, 255))
                r_core = r * 0.32
                draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=(255, 240, 245, 255))

    # ---------------------------------------------------- STATUS PILL WITH SPINNER
    status_label = "Učitavanje prijavnice… · Spremite se za start!"
    st_bbox = font_status.getbbox(status_label)
    st_w = st_bbox[2] - st_bbox[0]
    st_h = st_bbox[3] - st_bbox[1]

    spin_r = int(7 * scale)
    pill_content_w = spin_r * 2 + int(12 * scale) + st_w
    st_x = int((W - pill_content_w) / 2)
    st_y = gantry_y + pod_h + int(14 * scale)

    draw.rounded_rectangle(
        [st_x - int(18 * scale), st_y - int(7 * scale), st_x + pill_content_w + int(18 * scale), st_y + st_h + int(7 * scale)],
        radius=int(12 * scale),
        fill=(14, 28, 38, 230),
        outline=(0, 225, 165, 190),
        width=int(1.5 * scale)
    )

    # Vector spinner icon
    spin_cx = st_x + spin_r
    spin_cy = st_y + int(st_h / 2)
    draw_vector_spinner(draw, spin_cx, spin_cy, spin_r, (0, 245, 180, 255))

    # Text
    draw.text((st_x + spin_r * 2 + int(12 * scale), st_y), status_label, font=font_status, fill=(0, 245, 180, 255))

    # ---------------------------------------------------- MAIN TITLE
    t1 = "SIMULATOR PRIJAVE NA POTICAJE"
    t2 = "ZA ELEKTRIČNA VOZILA"

    t1_bbox = font_title1.getbbox(t1)
    t1_w = t1_bbox[2] - t1_bbox[0]
    t1_x = int((W - t1_w) / 2)
    t1_y = st_y + st_h + int(24 * scale)

    # Crisp white line 1
    draw.text((t1_x, t1_y), t1, font=font_title1, fill=(255, 255, 255, 255))

    # Electric cyan/emerald line 2
    t2_bbox = font_title2.getbbox(t2)
    t2_w = t2_bbox[2] - t2_bbox[0]
    t2_x = int((W - t2_w) / 2)
    t2_y = t1_y + int(48 * scale)
    draw.text((t2_x, t2_y), t2, font=font_title2, fill=(0, 235, 175, 255))

    # Subtitle
    sub = "Trening brzine i točnosti unosa podataka i PDF dokumentacije (EnU-2/26)"
    sub_bbox = font_sub.getbbox(sub)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_x = int((W - sub_w) / 2)
    sub_y = t2_y + int(56 * scale)
    draw.text((sub_x, sub_y), sub, font=font_sub, fill=(185, 200, 225, 255))

    # ---------------------------------------------------- BOTTOM CHIPS & DIGITAL TIMER
    card_y = sub_y + int(42 * scale)
    card_h = int(68 * scale)

    steps = [
        ("1", "Prijavitelj & OIB provjera"),
        ("2", "Obavezni PDF dokumenti"),
        ("3", "Predaja & Osobni rekord")
    ]
    step_start_x = int(50 * scale)
    step_w = int(240 * scale)
    step_gap = int(14 * scale)

    for idx, (num, label) in enumerate(steps):
        sx = step_start_x + idx * (step_w + step_gap)
        draw.rounded_rectangle(
            [sx, card_y, sx + step_w, card_y + card_h],
            radius=int(12 * scale),
            fill=(18, 25, 42, 230),
            outline=(45, 58, 85, 210),
            width=int(1.5 * scale)
        )
        c_r = int(13 * scale)
        cx = sx + int(22 * scale)
        cy = card_y + int(card_h / 2)
        draw.ellipse([cx - c_r, cy - c_r, cx + c_r, cy + c_r], fill=(0, 215, 155, 255))
        n_bbox = font_chip.getbbox(num)
        nw = n_bbox[2] - n_bbox[0]
        nh = n_bbox[3] - n_bbox[1]
        draw.text((cx - nw / 2, cy - nh / 2 - 1), num, font=font_chip, fill=(5, 20, 15, 255))
        draw.text((cx + c_r + int(10 * scale), cy - int(9 * scale)), label, font=font_chip, fill=(235, 240, 250, 255))

    # Digital Stopwatch HUD on right
    timer_x = step_start_x + 3 * (step_w + step_gap) + int(6 * scale)
    timer_w = W - timer_x - int(50 * scale)

    draw.rounded_rectangle(
        [timer_x, card_y, timer_x + timer_w, card_y + card_h],
        radius=int(12 * scale),
        fill=(14, 18, 28, 240),
        outline=(255, 60, 80, 190),
        width=int(1.5 * scale)
    )

    # Vector stopwatch icon inside HUD
    sw_size = int(14 * scale)
    sw_x = timer_x + int(16 * scale)
    sw_y = card_y + int(11 * scale)
    draw_vector_stopwatch(draw, sw_x, sw_y, sw_size, (255, 90, 110, 255))

    lbl_text = "PB ŠTOPERICA"
    draw.text((sw_x + sw_size + int(8 * scale), card_y + int(10 * scale)), lbl_text, font=font_timer_lbl, fill=(255, 95, 115, 255))

    time_str = "00:14.382 s"
    draw.text((timer_x + int(16 * scale), card_y + int(26 * scale)), time_str, font=font_timer_num, fill=(255, 255, 255, 255))

    # Bottom accent line (vibrant emerald)
    draw.rectangle([0, H - int(6 * scale), W, H], fill=(0, 215, 155, 255))

    final_img = base.resize((width, height), Image.Resampling.LANCZOS)
    return final_img

def render_apple_touch_icon(size=180):
    scale = 3
    S = size * scale

    icon = Image.new("RGBA", (S, S), (11, 16, 32, 255))
    draw = ImageDraw.Draw(icon)

    # Background gradient
    for y in range(S):
        t = y / float(S)
        r = int(12 * (1 - t * 0.4))
        g = int(18 * (1 - t * 0.5))
        b = int(36 * (1 - t * 0.55))
        draw.line([(0, y), (S, y)], fill=(r, g, b, 255))

    # Red glow at top behind lights
    glow_red = create_glow_circle(int(360 * scale), (255, 30, 50, 100), (200, 0, 30, 0), int(160 * scale))
    icon.alpha_composite(glow_red, (int(S / 2 - 180 * scale), int(6 * scale)))

    # Outer border
    draw.rounded_rectangle([1, 1, S - 2, S - 2], radius=int(36 * scale), outline=(45, 60, 90, 255), width=int(3 * scale))

    draw = ImageDraw.Draw(icon)

    # 5 F1 starting pods across top
    num_pods = 5
    pod_w = int(22 * scale)
    pod_h = int(62 * scale)
    pod_gap = int(7 * scale)
    total_w = num_pods * pod_w + (num_pods - 1) * pod_gap
    start_x = int((S - total_w) / 2)
    start_y = int(22 * scale)

    # Beam
    beam_h = int(6 * scale)
    beam_y = start_y + int(pod_h / 2 - beam_h / 2)
    draw.rectangle([start_x - int(8 * scale), beam_y, start_x + total_w + int(8 * scale), beam_y + beam_h], fill=(16, 16, 20, 255))

    lamp_dia = int(11 * scale)
    lamp_sp = int(3 * scale)

    for i in range(num_pods):
        px = start_x + i * (pod_w + pod_gap)
        py = start_y
        draw.rounded_rectangle(
            [px, py, px + pod_w, py + pod_h],
            radius=int(6 * scale),
            fill=(14, 14, 18, 255),
            outline=(60, 66, 82, 255),
            width=int(1.2 * scale)
        )
        cx = px + pod_w / 2.0
        total_lh = 4 * lamp_dia + 3 * lamp_sp
        ly_start = py + int((pod_h - total_lh) / 2)

        for l in range(4):
            cy = ly_start + l * (lamp_dia + lamp_sp) + lamp_dia / 2.0
            r = lamp_dia / 2.0
            if l < 2:
                # off
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(22, 22, 26, 255), outline=(36, 38, 44, 255))
            else:
                # lit bright red
                halo = create_glow_circle(int(36 * scale), (255, 30, 45, 130), (255, 0, 30, 0), int(16 * scale))
                icon.alpha_composite(halo, (int(cx - 18 * scale), int(cy - 18 * scale)))
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(235, 15, 45, 255))
                rc = r * 0.38
                draw.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=(255, 240, 245, 255))

    # Center EV badge text
    font_ev = ImageFont.truetype(FONT_BLACK_PATH, int(36 * scale))
    font_sub = ImageFont.truetype(FONT_BOLD_PATH, int(13 * scale))

    ev_text = "EV"
    bbox = font_ev.getbbox(ev_text)
    ew = bbox[2] - bbox[0]
    eh = bbox[3] - bbox[1]
    ex = int((S - ew) / 2)
    ey = start_y + pod_h + int(14 * scale)

    draw.text((ex, ey), ev_text, font=font_ev, fill=(0, 235, 175, 255))

    sub_text = "EnU-2/26"
    s_bbox = font_sub.getbbox(sub_text)
    sw = s_bbox[2] - s_bbox[0]
    sx = int((S - sw) / 2)
    sy = ey + eh + int(14 * scale)

    pad_x = 10 * scale
    pad_y = 3 * scale
    draw.rounded_rectangle(
        [sx - pad_x, sy - pad_y, sx + sw + pad_x, sy + s_bbox[3] - s_bbox[1] + pad_y + 1],
        radius=int(6 * scale),
        fill=(18, 28, 48, 230),
        outline=(0, 215, 155, 210),
        width=int(1.2 * scale)
    )
    draw.text((sx, sy), sub_text, font=font_sub, fill=(255, 255, 255, 255))

    final_icon = icon.resize((size, size), Image.Resampling.LANCZOS)
    return final_icon

def main():
    print("Generating OpenGraph card (1200x630)...")
    og_img = render_og_image(1200, 630, is_16_9=False)
    og_png_path = os.path.join(IMG_DIR, "og-image.png")
    og_jpg_path = os.path.join(IMG_DIR, "og-image.jpg")
    og_img.save(og_png_path, optimize=True)
    og_img.convert("RGB").save(og_jpg_path, quality=95, optimize=True)
    print(f"Saved: {og_png_path} and {og_jpg_path}")

    print("Generating Thumbnail card (1200x675 / 16:9)...")
    thumb_img = render_og_image(1200, 675, is_16_9=True)
    thumb_png_path = os.path.join(IMG_DIR, "thumbnail.png")
    thumb_jpg_path = os.path.join(IMG_DIR, "thumbnail.jpg")
    thumb_img.save(thumb_png_path, optimize=True)
    thumb_img.convert("RGB").save(thumb_jpg_path, quality=95, optimize=True)
    print(f"Saved: {thumb_png_path} and {thumb_jpg_path}")

    print("Generating Apple Touch Icon (180x180)...")
    icon_img = render_apple_touch_icon(180)
    icon_path = os.path.join(IMG_DIR, "apple-touch-icon.png")
    icon_img.save(icon_path, optimize=True)
    print(f"Saved: {icon_path}")

if __name__ == "__main__":
    main()
