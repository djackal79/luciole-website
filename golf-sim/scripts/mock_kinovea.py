#!/usr/bin/env python3
"""Pretend to be Kinovea finishing a capture.

Two modes, matching the two real ingest paths:

* ``--hook`` (default) reproduces the Automation hook -- write the clip, then
  POST its local path to /api/ingest/body_swing. This is the recommended
  production path.
* ``--watcher`` only drops the file in the export directory, for the fallback
  filesystem watcher. The file is written *incrementally*, so the watcher's
  write-completion detection is genuinely exercised; a naive watcher ingests a
  truncated file here.

    python scripts/mock_kinovea.py --export-dir data/kinovea_export
"""

from __future__ import annotations

import argparse
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _fixtures import make_clip  # noqa: E402


def export_clip(
    export_dir: Path,
    *,
    write_seconds: float = 1.0,
    chunks: int = 6,
    seconds: float = 4.0,
    container_fps: int = 30,
    use_temp_name: bool = False,
) -> Path:
    """Dribble a clip into the export directory over ``write_seconds``."""
    export_dir.mkdir(parents=True, exist_ok=True)
    filename = f"swing-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')[:-3]}.mp4"

    # Build the payload outside the watched directory -- a scratch file with a
    # video extension in there would be ingested as a phantom swing.
    with tempfile.TemporaryDirectory(prefix="mock-kinovea-") as scratch:
        source = make_clip(
            Path(scratch) / "swing.mp4",
            seconds=seconds,
            container_fps=container_fps,
            label="body_swing",
            # A body-swing clip with nobody in it cannot exercise pose.
            golfer=True,
        )
        payload = source.read_bytes()

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
    return final


def post_hook(
    base_url: str,
    clip: Path,
    *,
    source: str = "body_swing",
    capture_fps: float,
    container_fps: float,
    camera: str,
    duration_ms: int | None = None,
    width: int | None = None,
    height: int | None = None,
    token: str | None = None,
) -> dict:
    """What Kinovea's Automation command does: hand over the filename."""
    headers = {"X-Golfsim-Token": token} if token else {}
    response = httpx.post(
        f"{base_url}/api/ingest/body_swing",
        data={
            "path": str(clip.resolve()),
            # Routing key: face-on and down-the-line must not share a source.
            "source": source,
            "capture_fps": capture_fps,
            "container_fps": container_fps,
            "camera": camera,
            **({"duration_ms": duration_ms} if duration_ms else {}),
            **({"width": width} if width else {}),
            **({"height": height} if height else {}),
        },
        headers=headers,
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--export-dir", type=Path, default=Path("data/kinovea_export"))
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--interval", type=float, default=8.0)
    parser.add_argument("--write-seconds", type=float, default=1.0)
    parser.add_argument("--capture-fps", type=float, default=30.0)
    parser.add_argument("--container-fps", type=float, default=30.0)
    parser.add_argument("--camera", default="face_on")
    parser.add_argument("--source", default="body_swing",
                        choices=["body_swing", "body_swing_dtl"])
    parser.add_argument("--watcher", action="store_true",
                        help="drop the file only, for the fallback watcher")
    parser.add_argument("--temp-name", action="store_true",
                        help="write a dotfile and rename on close")
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    for index in range(args.count):
        clip = export_clip(
            args.export_dir,
            write_seconds=args.write_seconds,
            container_fps=int(args.container_fps),
            use_temp_name=args.temp_name,
        )
        if args.watcher:
            print(f"exported {clip} (waiting for the fallback watcher)")
        else:
            result = post_hook(
                args.base_url,
                clip,
                source=args.source,
                capture_fps=args.capture_fps,
                container_fps=args.container_fps,
                camera=args.camera,
                duration_ms=4000,
                width=640,
                height=480,
                token=args.token,
            )
            print(f"exported {clip.name} -> shot {result['shot_id']} ({result['status']})")
        if index + 1 < args.count:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
