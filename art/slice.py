# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
import base64, io
from pathlib import Path
from PIL import Image, ImageDraw

KAIJU = Path(__file__).parent / "kaiju-sheet.png"
OUT = Path(__file__).parent.parent / "src" / "sprite-data.ts"

def load(path):
    im = Image.open(path).convert("RGBA")
    corner = im.getpixel((0, 0))
    if corner[3] > 200:
        # opaque background: flood fill from the four corners to transparent
        for pt in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
            ImageDraw.floodfill(im, pt, (0, 0, 0, 0), thresh=60)
    return im

def bbox(im):
    return im.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()

def to_webp_uri(im, quality=82):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

def foot_x(im):
    a = im.getchannel("A")
    w, h = im.size
    rows = range(int(h * 0.94), h)
    xs, n = 0, 0
    px = a.load()
    for y in rows:
        for x in range(w):
            if px[x, y] > 12:
                xs += x; n += 1
    return (xs / n / w) if n else 0.5

# ---- kaiju
sheet = load(KAIJU)
cols = 3
cw = sheet.width // cols
frames = []
for i in range(cols):
    col = sheet.crop((i * cw, 0, (i + 1) * cw, sheet.height))
    b = bbox(col)
    frames.append(col.crop(b))
H = max(f.height for f in frames)
W = max(f.width for f in frames)
target_h = 384
scale = target_h / H
canvas_w = int(round(W * scale))
uris, feet = [], []
for f in frames:
    fw, fh = int(round(f.width * scale)), int(round(f.height * scale))
    fr = f.resize((fw, fh), Image.LANCZOS)
    c = Image.new("RGBA", (canvas_w, target_h), (0, 0, 0, 0))
    c.paste(fr, ((canvas_w - fw) // 2, target_h - fh))
    uris.append(to_webp_uri(c))
    feet.append(round(foot_x(c), 3))
poses = ["plantBack", "stride", "plantFront"]
ts = ['import type { MonsterPose } from "./sprites";', "",
      "export const MONSTER_FRAMES: Record<MonsterPose, string> = {"]
for p, u in zip(poses, uris):
    ts.append(f'    {p}: "{u}",')
ts += ["};", "", f"export const FRAME_ASPECT = {canvas_w} / {target_h};", "",
       "export const FRAME_FOOT_X: Record<MonsterPose, number> = {"]
for p, fx in zip(poses, feet):
    ts.append(f"    {p}: {fx},")
ts += ["};", ""]
OUT.write_text("\n".join(ts))
print("kaiju frames", canvas_w, target_h, feet, [len(u) // 1024 for u in uris], "KB")
