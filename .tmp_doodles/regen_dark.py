#!/usr/bin/env python3
"""Regenerate dark-mode doodle SVGs from the light source SVGs.

Per fill colour:
  - near-black / dark grey ink  -> light ink (#ECECEC)
  - large near-white "plate"     -> page background (#050507) so it reads as
                                    an empty/outlined shape, not a solid block
  - small near-white "dot"       -> light ink (#ECECEC) so it stays visible
  - coloured firework accents    -> unchanged
  - mid/light grey               -> unchanged (already visible on dark)
"""
import re
import sys
from pathlib import Path

DOODLES = ["fire", "burst", "play", "retry", "fountain", "willow"]
SRC = Path("platform/public/images/landing/doodles")

LIGHT_INK = "#ececec"
DARK_SURFACE = "#050507"  # marketing dark page background (--background)

NAMED = {"white": (255, 255, 255), "black": (0, 0, 0)}


def parse_color(value):
    value = value.strip().lower()
    if value in NAMED:
        return NAMED[value]
    if value.startswith("#"):
        h = value[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) == 6:
            return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
    return None


def luminance(rgb):
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def saturation(rgb):
    return max(rgb) - min(rgb)


# Near-white fills above this bounding-box area (in user units) are treated as
# solid "plates" (page bodies, mortar tubes) and recoloured to the dark page
# background; anything smaller is a decorative dot/highlight kept as light ink.
# Plates measure 2000-23000+ here, dots measure under ~60, so the gap is wide.
PLATE_AREA = 500.0


def path_area(d):
    nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", d)]
    xs = nums[0::2]
    ys = nums[1::2]
    if not xs or not ys:
        return 0.0
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def classify(rgb, area):
    """Return replacement colour, or None to keep unchanged."""
    sat = saturation(rgb)
    lum = luminance(rgb)
    if sat <= 24:  # neutral (ink / grey / paper)
        if lum >= 0.80:  # near-white
            return DARK_SURFACE if area >= PLATE_AREA else LIGHT_INK
        if lum <= 0.50:  # dark ink / dark grey sketch line
            return LIGHT_INK
        return None  # mid/light grey: visible already
    return None  # coloured accent: keep


def transform(svg):

    # Ensure the root svg carries a default light fill for any fill-less path.
    def set_root_fill(m):
        tag = m.group(0)
        if re.search(r'\bfill="', tag):
            return re.sub(r'\bfill="[^"]*"', f'fill="{LIGHT_INK}"', tag, count=1)
        return tag[:-1] + f' fill="{LIGHT_INK}">'

    svg = re.sub(r"<svg\b[^>]*>", set_root_fill, svg, count=1)

    def repl_path(m):
        path = m.group(0)
        fill_m = re.search(r'\bfill="([^"]*)"', path)
        d_m = re.search(r'\bd="([^"]*)"', path)
        d = d_m.group(1) if d_m else ""
        area = path_area(d)
        fill = fill_m.group(1) if fill_m else None
        rgb = parse_color(fill) if fill else (0, 0, 0)  # no fill => black ink
        if rgb is None:
            return path
        new = classify(rgb, area)
        if new is None:
            return path
        if fill_m:
            return path.replace(fill_m.group(0), f'fill="{new}"', 1)
        # inject fill into a fill-less path
        return path.replace("<path", f'<path fill="{new}"', 1)

    return re.sub(r"<path\b[^>]*/>", repl_path, svg)


def main():
    for name in DOODLES:
        light = SRC / f"{name}.svg"
        dark = SRC / f"{name}-dark.svg"
        svg = light.read_text()
        dark.write_text(transform(svg))
        print(f"wrote {dark}")


if __name__ == "__main__":
    sys.exit(main())
