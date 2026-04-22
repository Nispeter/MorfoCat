"""Generate placeholder icons for MorfoCat Tauri build."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
os.makedirs(OUT, exist_ok=True)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Blue rounded square background
    margin = size // 10
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 6,
        fill=(30, 100, 200, 255),
    )
    # White "M" letter centred
    font_size = size // 2
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "M", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) // 2 - bbox[0], (size - th) // 2 - bbox[1]),
        "M",
        fill=(255, 255, 255, 255),
        font=font,
    )
    return img

sizes = [32, 128, 256]
imgs = {s: make_icon(s) for s in sizes}

imgs[32].save(os.path.join(OUT, "32x32.png"))
imgs[128].save(os.path.join(OUT, "128x128.png"))

img_256 = make_icon(256)
img_256.save(os.path.join(OUT, "128x128@2x.png"))

# ICO — embed multiple sizes
ico_imgs = [make_icon(s) for s in [16, 32, 48, 64, 128, 256]]
ico_imgs[0].save(
    os.path.join(OUT, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]],
    append_images=ico_imgs[1:],
)

# ICNS placeholder (just a 1024 PNG renamed — macOS only needs this for bundling)
img_1024 = make_icon(1024)
img_1024.save(os.path.join(OUT, "icon.icns"), format="PNG")  # good enough for non-macOS builds

print("Icons generated:")
for f in sorted(os.listdir(OUT)):
    path = os.path.join(OUT, f)
    print(f"  {f}  ({os.path.getsize(path):,} bytes)")
