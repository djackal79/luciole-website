#!/usr/bin/env python3
"""Pretend to be Kinovea exporting a swing clip.

The file is written *incrementally* so the watcher's write-completion
detection is genuinely exercised -- a naive watcher would ingest a truncated
file here.

    python scripts/mock_kinovea.py --export-dir data/kinovea_export
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import make_clip  # noqa: E402


def export_clip(
    export_dir: Path,
    *,
    write_seconds: float = 1.5,
    chunks: int = 6,
    name: str | None = None,
    use_temp_name: bool = False,
) -> Path:
    """Dribble a clip into the export directory over ``write_seconds``."""
    export_dir.mkdir(parents=True, exist_ok=True)
    filename = name or f"swing-{datetime.now().strftime('%Y%m%d-%H%M%S')}.mp4"

    # Build the payload outside the watched directory -- a scratch file with a
    # video extension in there would be ingested as a phantom swing.
    with tempfile.TemporaryDirectory(prefix="mock-kinovea-") as scratch:
        source = make_clip(Path(scratch) / "swing.mp4", seconds=2.0, fps=120, label="swing")
        payload = source.read_bytes()

    # Kinovea writes to the final name and grows it; some encoders use a temp
    # name and rename on close. Both paths are supported by the watcher.
    working = export_dir / (f".{filename}.tmp" if use_temp_name else filename)
    step = max(len(payload) // chunks, 1)
    with working.open("wb") as handle:
        for offset in range(0, len(payload), step):
            handle.write(payload[offset : offset + step])
            handle.flush()
            time.sleep(write_seconds / chunks)

    final = export_dir / filename
    if use_temp_name:
        working.rename(final)
    print(f"exported {final} ({len(payload)} bytes over {write_seconds:.1f}s)")
    return final


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-dir", type=Path, default=Path("data/kinovea_export"))
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--interval", type=float, default=8.0, help="seconds between clips")
    parser.add_argument("--write-seconds", type=float, default=1.5)
    parser.add_argument(
        "--temp-name",
        action="store_true",
        help="write to a dotfile and rename on close (tests the on_moved path)",
    )
    args = parser.parse_args()

    for index in range(args.count):
        export_clip(
            args.export_dir,
            write_seconds=args.write_seconds,
            use_temp_name=args.temp_name,
        )
        if index + 1 < args.count:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
