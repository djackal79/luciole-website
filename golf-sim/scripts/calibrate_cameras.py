#!/usr/bin/env python3
"""Calibrate the two Kinovea cameras so pose can go 3D.

Shoulder turn, pelvis rotation and X-factor need depth. One camera cannot
measure them at all, and two uncalibrated cameras cannot either -- the pixels
have to be tied to metres first. This does that once; after it, every shot
picks the calibration up automatically, with no backend restart.

    python scripts/calibrate_cameras.py board --out board.png     # print this
    python scripts/calibrate_cameras.py intrinsics body_swing     lens/*.png
    python scripts/calibrate_cameras.py intrinsics body_swing_dtl lens_dtl/*.png
    python scripts/calibrate_cameras.py place body_swing     floor_face_on.png
    python scripts/calibrate_cameras.py place body_swing_dtl floor_dtl.png
    python scripts/calibrate_cameras.py status

THE BOARD is a ChArUco board -- a chessboard with a coded marker in every white
square -- and it has to be the one this script prints, because the markers are
what tell the two cameras they are looking at the same thing the same way round.
A plain chessboard has no origin: the corner ordering depends on the viewing
angle, and two cameras 90 degrees apart can easily read the same board mirrored
from each other, which triangulates a mirrored golfer without complaining.

Print it big and print it flat. The default is 1.5 x 1.05 m, which is a trip to
a print shop rather than an office printer, and the size is not optional: a
board lying on the floor seen from a camera at chest height several metres away
is foreshortened hard, and a small one is simply not found. Mount it on stiff
board -- a curled print calibrates the curl into the lens. Then MEASURE a
printed square with a ruler and pass the real number to --square-mm: that one
number sets the scale of the entire world, and "fit to page" quietly rescales it.

STEP 1, INTRINSICS -- what the lens does. Hold the board up in front of one
camera and grab a dozen frames at varied angles and distances, filling the
frame. Varied angles is the part people get wrong: a dozen views all parallel
to the sensor cannot separate focal length from distance, and the fit comes out
confidently wrong. Done once per camera per lens setting; it does not care where
the camera is.

STEP 2, PLACEMENT -- where the camera sits. Put the board FLAT ON THE FLOOR
where the golfer stands, leave it there, and take ONE frame from each camera
without moving it in between. Both cameras solved against the same board
position land in the same world frame, and that shared frame is what makes
triangulation work at 90 degrees apart. Board flat on the floor also makes the
world gravity-aligned, so "vertical" in the metrics means vertical in the room.

Frames can be images or a video file (every Nth frame is sampled from it).
"""


from __future__ import annotations

import argparse
import glob
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import get_settings  # noqa: E402
from backend.pose.calibration import (  # noqa: E402
    Board,
    Calibration,
    calibrate_intrinsics,
    camera_position,
    place_camera,
)

SOURCES = ("body_swing", "body_swing_dtl")

#: Above this the fit is not good enough to trust a body angle to.
GOOD_RMS_PX = 1.0

VIDEO_SUFFIXES = {".mp4", ".avi", ".mkv", ".mov", ".m4v"}


def _load_frames(patterns: list[str], every: int) -> list:
    """Images from files, globs, or every Nth frame of a video."""
    import cv2

    paths: list[Path] = []
    for pattern in patterns:
        matched = sorted(glob.glob(pattern))
        if not matched:
            raise SystemExit(f"nothing matches {pattern!r}")
        paths.extend(Path(p) for p in matched)

    frames = []
    for path in paths:
        if path.suffix.lower() in VIDEO_SUFFIXES:
            capture = cv2.VideoCapture(str(path))
            index = 0
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if index % every == 0:
                    frames.append(frame)
                index += 1
            capture.release()
            print(f"  {path.name}: {index} frames, sampled every {every}")
        else:
            image = cv2.imread(str(path))
            if image is None:
                raise SystemExit(f"could not read {path}")
            frames.append(image)
    return frames


def _board(args) -> Board:
    return Board(
        squares_x=args.squares_x,
        squares_y=args.squares_y,
        square_mm=args.square_mm,
        marker_mm=args.marker_mm,
    )


def _open(path: Path, board: Board) -> Calibration:
    existing = Calibration.load(path)
    if existing is None:
        return Calibration(board=board)
    if existing.board.as_dict() != board.as_dict():
        # Mixing two board geometries in one file would put the cameras in
        # differently scaled worlds, and triangulation would be quietly wrong.
        was, now = existing.board, board
        raise SystemExit(
            f"{path} was calibrated with a {was.squares_x}x{was.squares_y} board "
            f"of {was.square_mm} mm squares, not {now.squares_x}x{now.squares_y} "
            f"at {now.square_mm} mm.\n"
            f"Use the same board, or delete the file and start over."
        )
    return existing


def cmd_board(args) -> int:
    import cv2

    board = _board(args)
    width_mm, height_mm = board.size_mm
    image = board.generate_image(px_per_mm=args.px_per_mm)
    out = Path(args.out)
    if not cv2.imwrite(str(out), image):
        return _fail(f"could not write {out}")

    print(f"Wrote {out}  ({image.shape[1]} x {image.shape[0]} px)")
    print(f"  {board.squares_x} x {board.squares_y} squares of {board.square_mm} mm, "
          f"{board.marker_mm} mm markers, {board.dictionary}")
    print(f"  prints at {width_mm/1000:.2f} x {height_mm/1000:.2f} m "
          f"({args.px_per_mm * 25.4:.0f} dpi)")
    print()
    print("Print at 100% scale -- NOT 'fit to page' -- on stiff board, and lay")
    print("it flat. Then measure one square with a ruler. If it is not exactly")
    print(f"{board.square_mm} mm, pass the real figure to --square-mm from here on:")
    print("that number is the scale of the whole world.")
    return 0


def cmd_intrinsics(args) -> int:
    board = _board(args)
    path = get_settings().pose_calibration_path

    print(f"Reading board views for {args.source}...")
    frames = _load_frames(args.images, args.every)
    print(f"  {len(frames)} candidate frames")

    try:
        camera = calibrate_intrinsics(frames, board)
    except ValueError as exc:
        return _fail(
            f"{exc}\n"
            "The board must be fully in frame, well lit, and held at a range of\n"
            "angles -- a dozen shots all parallel to the sensor cannot separate\n"
            "focal length from distance."
        )

    calibration = _open(path, board)
    previous = calibration.cameras.get(args.source)
    if previous is not None and previous.placed:
        # The world pose was solved with the old lens model; keeping it would
        # pair new intrinsics with a stale placement.
        print("  lens model changed -- clearing the old placement for this camera")
    calibration.cameras[args.source] = camera
    calibration.created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    calibration.save(path)

    print(f"\n  RMS reprojection error: {camera.rms_px:.3f} px")
    if camera.rms_px > GOOD_RMS_PX:
        print("  ^ above 1.0 px. Usable, but body angles will carry that error.")
        print("    More angles, closer board, sharper focus.")
    print(f"  saved to {path}")
    print(f"\nNext: place the camera --  python {_me()} place {args.source} <floor.png>")
    return 0


def cmd_place(args) -> int:
    board = _board(args)
    path = get_settings().pose_calibration_path
    calibration = _open(path, board)

    camera = calibration.cameras.get(args.source)
    if camera is None:
        return _fail(
            f"no lens calibration for {args.source} yet.\n"
            f"Run:  python {_me()} intrinsics {args.source} <board views>"
        )

    frames = _load_frames([args.image], args.every)
    if not frames:
        return _fail("no frame read from that file")

    try:
        calibration.cameras[args.source] = place_camera(camera, frames[0], board)
    except ValueError as exc:
        return _fail(
            f"{exc}\n"
            "The board must be flat on the floor, printed-side-up, unmoved\n"
            "between the two cameras' frames, and fully visible in this one.\n"
            "If it is all of those and still not found, it is too small in the\n"
            "frame: a board on the floor seen from chest height metres away is\n"
            "foreshortened hard. Print it bigger, or move it nearer the camera\n"
            "-- but then it must not move between the two cameras' frames."
        )

    calibration.save(path)
    placed = calibration.cameras[args.source]
    print(f"\n  pose RMS: {placed.pose_rms_px:.3f} px")
    print(f"  saved to {path}")
    print()
    return _report(calibration)


def cmd_status(args) -> int:
    path = get_settings().pose_calibration_path
    calibration = Calibration.load(path)
    if calibration is None:
        print(f"No calibration at {path}. Pose stays 2D.")
        print(f"Start with:  python {_me()} intrinsics body_swing <board views>")
        return 1
    print(f"{path}")
    print(f"  board: {calibration.board.cols}x{calibration.board.rows} inner corners, "
          f"{calibration.board.square_mm} mm squares")
    print(f"  calibrated: {calibration.created_at}")
    print()
    return _report(calibration)


def _report(calibration: Calibration) -> int:
    for source in SOURCES:
        camera = calibration.cameras.get(source)
        if camera is None:
            print(f"  {source:16s} not calibrated")
        elif not camera.placed:
            print(f"  {source:16s} lens done ({camera.rms_px:.2f} px), not placed")
        else:
            where = camera_position(camera)
            print(
                f"  {source:16s} ready  lens {camera.rms_px:.2f} px, "
                f"pose {camera.pose_rms_px:.2f} px"
            )
            print(
                f"  {'':16s}        {where[0]:+.2f}, {where[1]:+.2f} m from the "
                f"board's corner, {where[2]:.2f} m up"
            )

    placed = [calibration.cameras[s] for s in SOURCES if s in calibration.triangulable]
    if len(placed) == 2:
        import numpy as np

        apart = float(np.linalg.norm(camera_position(placed[0]) - camera_position(placed[1])))
        print()
        print(f"  the two cameras solve to {apart:.2f} m apart")
        print("  ^ worth a tape measure. If that number is wrong, so is every")
        print("    distance the 3D metrics are built on -- most likely because")
        print("    --square-mm does not match the board that was actually printed.")

    print()
    if calibration.ready:
        print("3D is on. The next shot with pose will carry shoulder turn,")
        print("pelvis rotation and X-factor -- no backend restart needed.")
        print()
        print("One thing left: both Kinovea hooks need IMPACT_MS set. Two capture")
        print("screens start independently, so impact is the only clock the clips")
        print("share, and without it the backend will decline to triangulate.")
        return 0

    missing = [s for s in SOURCES if s not in calibration.triangulable]
    print(f"Not ready: {', '.join(missing)} still to do. Pose stays 2D until both")
    print("cameras are placed against the same board position.")
    return 1


def _me() -> str:
    return "scripts/calibrate_cameras.py"


def _fail(message: str) -> int:
    print(f"\nFAILED: {message}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--squares-x", type=int, default=10, help="squares across")
    parser.add_argument("--squares-y", type=int, default=7, help="squares down")
    parser.add_argument(
        "--square-mm", type=float, default=150.0,
        help="printed square size. MEASURE IT -- 'fit to page' rescales the "
             "board, and this number sets the scale of the whole world.",
    )
    parser.add_argument(
        "--marker-mm", type=float, default=110.0,
        help="printed marker size; must fit inside a square (default 0.73x)",
    )
    parser.add_argument(
        "--every", type=int, default=15,
        help="when a video is given, sample every Nth frame (default 15)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    printable = sub.add_parser("board", help="write a printable board image")
    printable.add_argument("--out", default="charuco_board.png")
    printable.add_argument(
        "--px-per-mm", type=float, default=4.0, help="about 100 dpi by default"
    )
    printable.set_defaults(func=cmd_board)

    lens = sub.add_parser("intrinsics", help="solve one camera's lens")
    lens.add_argument("source", choices=SOURCES)
    lens.add_argument("images", nargs="+", help="image files, globs, or a video")
    lens.set_defaults(func=cmd_intrinsics)

    place = sub.add_parser("place", help="solve where one camera sits")
    place.add_argument("source", choices=SOURCES)
    place.add_argument("image", help="one frame of the board flat on the floor")
    place.set_defaults(func=cmd_place)

    status = sub.add_parser("status", help="what is done and what is left")
    status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    try:
        import cv2  # noqa: F401
    except ImportError:
        return _fail(
            "OpenCV is not installed.\n    pip install -r requirements-pose.txt"
        )
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
