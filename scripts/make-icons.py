#!/usr/bin/env python3
"""Draw the trainer icon: two overlapping cards on a deep teal field."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"


def rounded(x, y, box, radius):
    left, top, right, bottom = box
    if x < left or x > right or y < top or y > bottom:
        return False
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def write_png(path, size, paint):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(paint(x, y, size))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def mark(x, y, size, pad):
    def box(nx, ny, nw, nh):
        return (nx * size, ny * size, (nx + nw) * size, (ny + nh) * size)
    back = box(0.30 + pad, 0.22 + pad, 0.46, 0.58)
    front = box(0.22 + pad, 0.32 + pad, 0.46, 0.50)
    if rounded(x, y, front, size * 0.06):
        return (242, 255, 251, 255)
    if rounded(x, y, back, size * 0.06):
        return (142, 232, 210, 255)
    return None


def icon(maskable=False):
    pad = 0.08 if maskable else 0.0
    def paint(x, y, size):
        field = (13, 74, 68, 255)
        drawn = mark(x, y, size, pad)
        return drawn or field
    return paint


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    write_png(ROOT / "icon-192.png", 192, icon(False))
    write_png(ROOT / "icon-512.png", 512, icon(False))
    write_png(ROOT / "icon-maskable-512.png", 512, icon(True))
    write_png(ROOT / "apple-touch-icon.png", 180, icon(True))


if __name__ == "__main__":
    main()
