"""Generate the Neuro OS app icon (PNG + multi-size ICO) with Pillow."""
from PIL import Image, ImageDraw
import math
import os

OUT = r"C:\Work\Research\AGI\Neuro Os\resources\brand"
os.makedirs(OUT, exist_ok=True)

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square background with a vertical navy gradient.
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
for y in range(S):
    t = y / S
    r = int(18 + 10 * t)
    g = int(20 + 22 * t)
    b = int(30 + 48 * t)
    bd.line([(0, y), (S, y)], fill=(r, g, b, 255))
mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
img.paste(bg, (0, 0), mask)

# Soft radial glow behind the mark.
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for i in range(28, 0, -1):
    radius = int(S * 0.30 * i / 28)
    alpha = int(3.2 * (28 - i))
    gd.ellipse(
        [S // 2 - radius, S // 2 - radius, S // 2 + radius, S // 2 + radius],
        fill=(86, 134, 254, max(0, alpha)),
    )
img = Image.alpha_composite(img, glow)
d = ImageDraw.Draw(img)

cx, cy = S // 2, S // 2

# Three orbital ellipses, drawn as rotated arcs.
def ellipse_points(rx, ry, angle_deg, n=240):
    a = math.radians(angle_deg)
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        x = rx * math.cos(t)
        y = ry * math.sin(t)
        xr = x * math.cos(a) - y * math.sin(a)
        yr = x * math.sin(a) + y * math.cos(a)
        pts.append((cx + xr, cy + yr))
    return pts

orbits = [
    (int(S * 0.36), int(S * 0.155), -26, (120, 160, 255, 235), 16),
    (int(S * 0.36), int(S * 0.155), 46, (167, 139, 250, 190), 13),
    (int(S * 0.36), int(S * 0.155), 108, (86, 134, 254, 120), 9),
]
for rx, ry, angle, color, width in orbits:
    d.line(ellipse_points(rx, ry, angle), fill=color, width=width, joint="curve")

# Nucleus.
core_r = int(S * 0.095)
for i in range(core_r, 0, -1):
    t = i / core_r
    r = int(255 - 120 * (1 - t))
    g = int(255 - 60 * (1 - t))
    b = 255
    d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, 255))
d.ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r], outline=(255, 255, 255, 230), width=max(2, S // 320))

# Two satellites.
for (sx, sy, sr, col) in [
    (cx + int(S * 0.285), cy - int(S * 0.215), int(S * 0.030), (86, 134, 254, 255)),
    (cx - int(S * 0.300), cy + int(S * 0.235), int(S * 0.022), (167, 139, 250, 255)),
]:
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=col)

# Subtle inner border.
d.rounded_rectangle([2, 2, S - 3, S - 3], radius=int(S * 0.225), outline=(255, 255, 255, 26), width=3)

png512 = img.resize((512, 512), Image.LANCZOS)
png512.save(os.path.join(OUT, "icon.png"), "PNG")

# macOS-ish / taskbar sizes.
for size in (16, 24, 32, 48, 64, 128, 256):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f"icon-{size}.png"), "PNG")

img.resize((256, 256), Image.LANCZOS).save(
    os.path.join(OUT, "icon.ico"),
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

print("icon written to", OUT)
