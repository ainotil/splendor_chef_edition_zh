"""把一包调味图片（zip 里的大 PNG）处理成游戏里用的小图。

每张图：找到主体的范围（和背景色差得多的像素）→ 以主体为中心裁成正方形 →
缩到 256×256 → 存成 WebP 到 src/assets/seasonings/<游戏里的代号>.webp

用法：python3 scripts/import-seasoning-art.py seasonings_assets.zip
需要 Pillow（pip install pillow）。
"""
import sys
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops

OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'seasonings'
SIZE = 256
MARGIN = 1.3        # 正方形边长 = 主体长边 × MARGIN（留够边，放进圆形代币也不被切）
THRESHOLD = 28      # 和背景色差多少算主体

# zip 里的文件名 → 游戏里的代号
NAMES = {
    'sugar.png': 'sugar',
    'soysauce.png': 'soy',
    'chilli.png': 'chili',
    'greenpepper.png': 'peppercorn',
    'vinegar.png': 'vinegar',
    'broth.png': 'stock',
}


def subject_box(im):
    """主体的包围盒。背景色取左上角；右下角留给生成器水印，不参与计算。"""
    w, h = im.size
    bg = Image.new('RGB', im.size, im.getpixel((5, 5)))
    diff = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > THRESHOLD else 0)
    diff.paste(0, (int(w * 0.8), int(h * 0.88), w, h))
    return diff.getbbox()


def square_crop(im, box):
    left, top, right, bottom = box
    side = int(max(right - left, bottom - top) * MARGIN)
    side = min(side, *im.size)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    x = min(max(cx - side // 2, 0), im.width - side)
    y = min(max(cy - side // 2, 0), im.height - side)
    return im.crop((x, y, x + side, y + side))


def main(zip_path):
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for src, key in NAMES.items():
            im = Image.open(BytesIO(z.read(src))).convert('RGB')
            out = square_crop(im, subject_box(im)).resize((SIZE, SIZE), Image.LANCZOS)
            dest = OUT / f'{key}.webp'
            out.save(dest, 'WEBP', quality=86, method=6)
            print(f'{src:16} → {dest.relative_to(OUT.parent.parent.parent)} ({dest.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
