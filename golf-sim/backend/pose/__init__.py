"""Pose estimation from the Kinovea body-swing clips.

Pose is *derived*, not captured: it is computed after a shot closes, so it
arrives later than everything else and the UI has to handle a pending state.
"""

from .extractor import PoseExtractor, PoseTrack, ExtractionError
from .metrics import summarise

__all__ = ["PoseExtractor", "PoseTrack", "ExtractionError", "summarise"]
