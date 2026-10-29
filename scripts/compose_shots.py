"""Compose marketing-quality product shots from raw CI screenshots.

Usage: python3 scripts/compose_shots.py
Reads docs/screenshots/raw/{desktop,start-menu,games}.png and writes framed
versions (rounded corners, soft shadow, gradient backdrop) to docs/screenshots/.
"""

from PIL import Image, ImageDraw, ImageFilter

RAW = 'docs/screenshots/raw'
OUT = 'docs/screenshots'


def gradient_backdrop(size, top=(13, 27, 46), bottom=(6, 42, 58)):
    width, height = size
    strip = Image.new('RGB', (1, 256))
    for y in range(256):
        t = y / 255
        strip.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    backdrop = strip.resize((width, height), Image.BICUBIC)
    glow = Image.new('L', (width // 8, height // 8), 0)
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-40, -60, glow.width + 40, glow.height // 2 + 40), fill=70)
    glow = glow.resize((width, height), Image.BICUBIC).filter(ImageFilter.GaussianBlur(60))
    teal = Image.new('RGB', (width, height), (20, 120, 150))
    return Image.composite(teal, backdrop, glow.point(lambda v: v // 3))


def frame(src, dst, width, pad_x=110, pad_y=88, radius=26):
    shot = Image.open(src).convert('RGBA')
    content_w = width - pad_x * 2
    scale = content_w / shot.width
    shot = shot.resize((content_w, round(shot.height * scale)), Image.LANCZOS)
    canvas_w, canvas_h = width, shot.height + pad_y * 2

    backdrop = gradient_backdrop((canvas_w, canvas_h)).convert('RGBA')

    # soft drop shadow behind the shot
    shadow = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    mask = Image.new('L', (content_w, shot.height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, content_w - 1, shot.height - 1), radius=radius, fill=200)
    shadow.paste((0, 0, 0, 255), (pad_x - 6, pad_y + 22), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    backdrop = Image.alpha_composite(backdrop, shadow)

    # rounded shot
    rounded = Image.new('RGBA', (content_w, shot.height), (0, 0, 0, 0))
    rounded.paste(shot, (0, 0))
    clip = Image.new('L', (content_w, shot.height), 0)
    ImageDraw.Draw(clip).rounded_rectangle((0, 0, content_w - 1, shot.height - 1), radius=radius, fill=255)
    rounded.putalpha(clip)
    backdrop.alpha_composite(rounded, (pad_x, pad_y))

    # hairline border
    border = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        (pad_x - 1, pad_y - 1, pad_x + content_w, pad_y + shot.height), radius=radius, outline=(255, 255, 255, 46), width=2,
    )
    backdrop = Image.alpha_composite(backdrop, border)

    backdrop.convert('RGB').save(dst, optimize=True)
    print('wrote', dst)


frame(f'{RAW}/desktop.png', f'{OUT}/hero-desktop.png', 1600)
frame(f'{RAW}/start-menu.png', f'{OUT}/gallery-start.png', 1280)
frame(f'{RAW}/games.png', f'{OUT}/gallery-games.png', 1280)
