#!/usr/bin/env python3
import glob
import io
import os
import sys

import cairosvg
from PIL import Image, ImageDraw

src_dir = sys.argv[1]
out_png = sys.argv[2]
cell = 240
cols = 5

files = sorted(glob.glob(os.path.join(src_dir, "*.svg")))
thumbs = []
for f in files:
    png = cairosvg.svg2png(url=f, output_width=cell - 20, output_height=cell - 20,
                           background_color="white")
    im = Image.open(io.BytesIO(png)).convert("RGB")
    thumbs.append((os.path.basename(f), im))

rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cell, rows * cell), "white")
draw = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(thumbs):
    r, c = divmod(i, cols)
    x, y = c * cell, r * cell
    sheet.paste(im, (x + 10, y + 10))
    draw.rectangle([x, y, x + cell - 1, y + cell - 1], outline="#cccccc")
    draw.text((x + 6, y + cell - 14), name[-22:], fill="#333333")
sheet.save(out_png)
print(f"wrote {out_png} with {len(thumbs)} cells")
