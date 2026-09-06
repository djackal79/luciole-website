"""MediaPipe Pose landmark order.

The pipeline emits points in this order and writes the list into every
``pose.json``. Consumers should read the order from the file rather than
hard-coding it, so a model change cannot silently rewire a skeleton.
"""

from __future__ import annotations

MEDIAPIPE_LANDMARKS: list[str] = [
    "nose",
    "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear",
    "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_pinky", "right_pinky",
    "left_index", "right_index",
    "left_thumb", "right_thumb",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
    "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]

INDEX = {name: i for i, name in enumerate(MEDIAPIPE_LANDMARKS)}
