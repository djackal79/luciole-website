#!/usr/bin/env python3
"""Regenerate the web-sized card thumbnails used by index.html.

The landing page galleries and the hero montage read from
`assets/thumbs/`, not the full-size art. The source PNGs are ~21 MB in
total, which is far too heavy for a landing page; these thumbnails come
in around 1.3 MB for the same 60 images.

Run this after replacing any card art:

    python3 game/tools/make-thumbs.py

Requires Pillow (`pip install Pillow`). Nothing else in the build depends
on it — `npm run build` is a flat file copy and will simply pick up
whatever is in assets/thumbs at deploy time.

Source                          -> Thumbnail
  assets/venues/{1..52}.png     -> assets/thumbs/venues/{N}.jpg      (300px wide)
  assets/characters/{1..8}.png  -> assets/thumbs/characters/{N}.jpg  (380px wide)
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

# Paths are relative to the game/ directory, so the script works from the
# repo root or from game/ itself.
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)

JOBS = [
    ("assets/venues", "assets/thumbs/venues", range(1, 53), 300),
    ("assets/characters", "assets/thumbs/characters", range(1, 9), 380),
]

QUALITY = 82


def build(src_dir, out_dir, numbers, width):
    src_abs = os.path.join(GAME, src_dir)
    out_abs = os.path.join(GAME, out_dir)
    os.makedirs(out_abs, exist_ok=True)

    before = after = 0
    missing = []

    for n in numbers:
        src = os.path.join(src_abs, f"{n}.png")
        if not os.path.exists(src):
            missing.append(n)
            continue
        dst = os.path.join(out_abs, f"{n}.jpg")
        im = Image.open(src).convert("RGB")
        height = round(im.height * width / im.width)
        im = im.resize((width, height), Image.LANCZOS)
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        before += os.path.getsize(src)
        after += os.path.getsize(dst)

    done = len(list(numbers)) - len(missing)
    print(f"  {src_dir:22} {done:>3} images  "
          f"{before / 1024 / 1024:6.1f} MB -> {after / 1024 / 1024:5.2f} MB")
    if missing:
        print(f"  {'':22} MISSING: {missing}")
    return before, after, missing


def main():
    print("Regenerating card thumbnails...")
    total_before = total_after = 0
    all_missing = []
    for src, out, numbers, width in JOBS:
        b, a, m = build(src, out, numbers, width)
        total_before += b
        total_after += a
        all_missing += m

    if total_before:
        saving = 100 - (total_after / total_before * 100)
        print(f"\n  total {total_before / 1024 / 1024:.1f} MB -> "
              f"{total_after / 1024 / 1024:.1f} MB ({saving:.0f}% smaller)")

    if all_missing:
        print("\nSome source images were missing — thumbnails for those were "
              "left as they were. Check the numbering: card art must be named "
              "by its card number, 1-52 for Power Cards and 1-8 for Character "
              "Cards.")
        return 1
    print("\nDone. Commit the regenerated files in assets/thumbs/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
