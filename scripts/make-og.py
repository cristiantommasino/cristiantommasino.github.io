"""Generates public/og.png (1200x630), the image shown when the site is shared on social media.
Run again after changing your name/role:  python scripts/make-og.py
"""
import glob, os, random
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
PAPER, INK, INK2, HEMA, EOSIN = "#fbfaf7", "#1b1a22", "#4c4957", "#3e3a8c", "#a8325f"

def font(candidates, size):
    for c in candidates:
        for path in glob.glob(c):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default(size)

nm = os.path.join(ROOT, "node_modules", "@fontsource")
serif = font([os.path.join(ROOT, "node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2"), "C:/Windows/Fonts/georgiab.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"], 76)
sans = font([os.path.join(nm, "ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2"), "C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"], 34)
mono = font([os.path.join(nm, "ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2"), "C:/Windows/Fonts/consola.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"], 26)
try:
    serif.set_variation_by_axes([560, 60])  # weight, optical size of the variable font
except Exception:
    pass

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# Cell-graph motif on the right.
random.seed(4)
pts = []
while len(pts) < 34:
    x, y = random.uniform(780, 1160), random.uniform(40, 590)
    if all((x - a) ** 2 + (y - b) ** 2 > 62 ** 2 for a, b in pts):
        pts.append((x, y))
for i, (x, y) in enumerate(pts):
    near = sorted(pts, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)[1:4]
    for (a, b) in near:
        if (a - x) ** 2 + (b - y) ** 2 < 140 ** 2:
            d.line([(x, y), (a, b)], fill="#b9b6d9", width=3)
for i, (x, y) in enumerate(pts):
    rx, ry = random.uniform(11, 17), random.uniform(9, 13)
    d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=EOSIN if i % 6 == 0 else HEMA)

d.rectangle([0, 0, 14, H], fill=HEMA)
d.text((80, 175), "Cristian Tommasino", font=serif, fill=INK)
d.text((82, 285), "Assistant Professor · DIETI", font=sans, fill=INK2)
d.text((82, 330), "University of Naples Federico II", font=sans, fill=INK2)
d.text((82, 420), "Computational pathology · Graph learning", font=mono, fill=EOSIN)
d.text((82, 458), "Vision-language models", font=mono, fill=EOSIN)

img.save(os.path.join(ROOT, "public", "og.png"), optimize=True)
print("written public/og.png")
