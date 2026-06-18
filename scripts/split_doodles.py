#!/usr/bin/env python3
"""Split a flat doodle asset-sheet SVG into individual doodle SVGs.

The asset sheets are a single canvas containing many separate doodles drawn as
ungrouped <path> elements. This tool:
  1. parses every <path>,
  2. drops near-full-canvas background fills,
  3. clusters the remaining paths by bounding-box proximity (union-find),
  4. writes each cluster to its own tightly-cropped SVG.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET

from svgpathtools import parse_path

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def local(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


class DSU:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, a: int) -> int:
        while self.parent[a] != a:
            self.parent[a] = self.parent[self.parent[a]]
            a = self.parent[a]
        return a

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def boxes_near(a, b, pad: float) -> bool:
    axmin, axmax, aymin, aymax = a
    bxmin, bxmax, bymin, bymax = b
    gap_x = max(bxmin - axmax, axmin - bxmax)
    gap_y = max(bymin - aymax, aymin - bymax)
    return gap_x <= pad and gap_y <= pad


def fmt(n: float) -> str:
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return s if s else "0"


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return s or "sheet"


def split_sheet(path: str, out_dir: str, pad: float, min_area: float,
                bg_threshold: float) -> int:
    tree = ET.parse(path)
    root = tree.getroot()

    vb = root.get("viewBox")
    if vb:
        _, _, cw, ch = (float(x) for x in vb.replace(",", " ").split())
    else:
        cw = float(root.get("width", "0") or 0)
        ch = float(root.get("height", "0") or 0)
    canvas_area = cw * ch if cw and ch else None

    paths = [el for el in root.iter() if local(el.tag) == "path" and el.get("d")]

    items = []  # (bbox, element, area)
    bg_fill = "#FFFFFF"
    for el in paths:
        d = el.get("d")
        try:
            bbox = parse_path(d).bbox()  # (xmin, xmax, ymin, ymax)
        except Exception:
            continue
        xmin, xmax, ymin, ymax = bbox
        area = (xmax - xmin) * (ymax - ymin)
        if canvas_area and area >= bg_threshold * canvas_area:
            f = el.get("fill")
            if f:
                bg_fill = f
            continue
        items.append((bbox, el, area))

    if not items:
        return 0

    n = len(items)
    dsu = DSU(n)
    for i in range(n):
        for j in range(i + 1, n):
            if boxes_near(items[i][0], items[j][0], pad):
                dsu.union(i, j)

    clusters: dict[int, list[int]] = {}
    for i in range(n):
        clusters.setdefault(dsu.find(i), []).append(i)

    records = []
    for members in clusters.values():
        xmin = min(items[i][0][0] for i in members)
        xmax = max(items[i][0][1] for i in members)
        ymin = min(items[i][0][2] for i in members)
        ymax = max(items[i][0][3] for i in members)
        total_area = sum(items[i][2] for i in members)
        records.append((xmin, ymin, xmax, ymax, total_area, members))

    records = [r for r in records if r[4] >= min_area]
    row_h = max(40.0, ch * 0.12) if ch else 80.0
    records.sort(key=lambda r: (round(r[1] / row_h), r[0]))

    base = slugify(os.path.splitext(os.path.basename(path))[0])
    sheet_dir = os.path.join(out_dir, base)
    os.makedirs(sheet_dir, exist_ok=True)

    written = 0
    for idx, (xmin, ymin, xmax, ymax, _area, members) in enumerate(records, 1):
        bx = xmin - pad
        by = ymin - pad
        bw = (xmax - xmin) + 2 * pad
        bh = (ymax - ymin) + 2 * pad

        svg = ET.Element(f"{{{SVG_NS}}}svg", {
            "viewBox": f"{fmt(bx)} {fmt(by)} {fmt(bw)} {fmt(bh)}",
            "width": fmt(bw),
            "height": fmt(bh),
        })
        ET.SubElement(svg, f"{{{SVG_NS}}}rect", {
            "x": fmt(bx), "y": fmt(by),
            "width": fmt(bw), "height": fmt(bh),
            "fill": bg_fill,
        })
        for i in members:
            el = items[i][1]
            new = ET.SubElement(svg, f"{{{SVG_NS}}}path")
            for k, v in el.attrib.items():
                new.set(local(k), v)

        out_path = os.path.join(sheet_dir, f"{base}-{idx:03d}.svg")
        ET.ElementTree(svg).write(out_path, encoding="unicode", xml_declaration=False)
        with open(out_path, "r", encoding="utf-8") as fh:
            body = fh.read()
        with open(out_path, "w", encoding="utf-8") as fh:
            fh.write('<?xml version="1.0" encoding="utf-8"?>\n' + body)
        written += 1

    print(f"{os.path.basename(path)}: {written} doodles -> {sheet_dir}")
    return written


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--pad", type=float, default=14.0)
    ap.add_argument("--min-area", type=float, default=120.0)
    ap.add_argument("--bg-threshold", type=float, default=0.55)
    args = ap.parse_args()

    total = 0
    for inp in args.inputs:
        total += split_sheet(inp, args.out, args.pad, args.min_area,
                             args.bg_threshold)
    print(f"\nTotal individual doodles written: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
