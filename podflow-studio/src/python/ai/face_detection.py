#!/usr/bin/env python3
"""
Face Detection Module for Auto-Orient

Detects faces in video frames to determine speaker position.
Uses OpenCV's DNN face detector for fast, accurate detection.

Falls back to center if no face detected.
"""

import os
import subprocess
import tempfile
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import json


@dataclass
class FaceDetection:
    """A detected face with position info."""
    x: float  # Normalized 0-1 (left edge of face)
    y: float  # Normalized 0-1 (top edge of face)
    w: float  # Normalized width
    h: float  # Normalized height
    confidence: float
    
    @property
    def center_x(self) -> float:
        """Get the horizontal center of the face (0-1)."""
        return self.x + self.w / 2
    
    @property
    def center_y(self) -> float:
        """Get the vertical center of the face (0-1)."""
        return self.y + self.h / 2
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'x': self.x,
            'y': self.y,
            'w': self.w,
            'h': self.h,
            'confidence': self.confidence,
            'center_x': self.center_x,
            'center_y': self.center_y,
        }


@dataclass
class SpeakerPosition:
    """Detected speaker position for a clip."""
    position: str  # 'left', 'center', 'right'
    confidence: float
    face_center_x: Optional[float] = None  # 0-1, where face center is
    num_faces: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'position': self.position,
            'confidence': self.confidence,
            'face_center_x': self.face_center_x,
            'num_faces': self.num_faces,
        }


def detect_speaker_position_for_clip(
    video_path: str,
    start_time: float,
    end_time: float,
    num_samples: int = 5,
) -> SpeakerPosition:
    """
    Detect speaker position for a clip by sampling frames.
    
    Args:
        video_path: Path to video file
        start_time: Clip start time in seconds
        end_time: Clip end time in seconds
        num_samples: Number of frames to sample
        
    Returns:
        SpeakerPosition with detected position
    """
    try:
        import cv2
        return _detect_with_opencv(video_path, start_time, end_time, num_samples)
    except ImportError:
        # Fallback: try using ffmpeg + basic detection
        return _detect_with_ffmpeg_fallback(video_path, start_time, end_time)


def _detect_with_opencv(
    video_path: str,
    start_time: float,
    end_time: float,
    num_samples: int = 5,
) -> SpeakerPosition:
    """Use OpenCV for face detection."""
    import cv2
    import numpy as np
    
    # Load OpenCV's DNN face detector
    model_path = _get_face_model_path()
    if not model_path:
        # Fallback to Haar cascade if DNN model not available
        return _detect_with_haar(video_path, start_time, end_time, num_samples)
    
    net = cv2.dnn.readNetFromCaffe(
        model_path['prototxt'],
        model_path['caffemodel']
    )
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return SpeakerPosition(position='center', confidence=0.0)
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Sample frames evenly across the clip
    duration = end_time - start_time
    sample_times = [
        start_time + (duration * i / max(1, num_samples - 1))
        for i in range(num_samples)
    ]
    
    all_faces: List[FaceDetection] = []
    
    for sample_time in sample_times:
        frame_num = int(sample_time * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        
        if not ret:
            continue
        
        # Detect faces
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)), 
            1.0, (300, 300), 
            (104.0, 177.0, 123.0)
        )
        net.setInput(blob)
        detections = net.forward()
        
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > 0.5:
                box = detections[0, 0, i, 3:7] * np.array([
                    frame_width, frame_height, frame_width, frame_height
                ])
                x1, y1, x2, y2 = box.astype(int)
                
                all_faces.append(FaceDetection(
                    x=x1 / frame_width,
                    y=y1 / frame_height,
                    w=(x2 - x1) / frame_width,
                    h=(y2 - y1) / frame_height,
                    confidence=float(confidence),
                ))
    
    cap.release()
    
    return _determine_position_from_faces(all_faces)


def _detect_with_haar(
    video_path: str,
    start_time: float,
    end_time: float,
    num_samples: int = 5,
) -> SpeakerPosition:
    """Fallback to Haar cascade face detection."""
    import cv2
    
    # Use OpenCV's built-in Haar cascades.
    # Frontal-only cascades fail on profile/side angles, so we combine multiple.
    cascades = []
    cascade_specs = [
        ('haarcascade_frontalface_default.xml', 0.70),
        ('haarcascade_frontalface_alt2.xml', 0.75),
        ('haarcascade_profileface.xml', 0.65),
    ]
    for filename, conf in cascade_specs:
        cascade_path = cv2.data.haarcascades + filename
        classifier = cv2.CascadeClassifier(cascade_path)
        # Some OpenCV builds may not ship every cascade; skip silently.
        if classifier is not None and not classifier.empty():
            cascades.append((filename, classifier, conf))
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return SpeakerPosition(position='center', confidence=0.0)
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    duration = end_time - start_time
    sample_times = [
        start_time + (duration * i / max(1, num_samples - 1))
        for i in range(num_samples)
    ]
    
    all_faces: List[FaceDetection] = []
    person_centers: List[Tuple[float, float]] = []  # (center_x_norm, area_px)

    # Extra fallback: upper-body / full-body Haar detectors (often work when faces are occluded
    # or extreme profile). These are cheap and available in many OpenCV builds.
    body_detectors = []
    body_specs = [
        ('haarcascade_upperbody.xml', 0.40),
        ('haarcascade_fullbody.xml', 0.35),
    ]
    for filename, conf in body_specs:
        cascade_path = cv2.data.haarcascades + filename
        classifier = cv2.CascadeClassifier(cascade_path)
        if classifier is not None and not classifier.empty():
            body_detectors.append((filename, classifier, conf))

    # Extra robustness: if faces aren't detected (profile shots, occlusions),
    # use a lightweight person detector to estimate the subject center.
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    
    for sample_time in sample_times:
        frame_num = int(sample_time * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        
        if not ret:
            continue
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Helps with low-contrast podcast setups
        gray = cv2.equalizeHist(gray)

        # Last-resort fallback: estimate subject center using edge/contrast energy.
        # This helps when faces are profile/occluded and body/HOG detectors miss.
        # We avoid the bottom band (captions/table) and look for a strong horizontal peak.
        try:
            h, w = gray.shape[:2]
            y0 = int(h * 0.18)
            y1 = int(h * 0.85)
            roi = gray[y0:y1, :]
            if roi.size > 0:
                edges = cv2.Canny(roi, 50, 150)
                col = edges.sum(axis=0).astype('float64')
                total = float(col.sum())
                if total > 0:
                    avg = float(total / max(1, len(col)))
                    peak = float(col.max())
                    # Require a meaningful peak to avoid biasing to background edges
                    if avg > 0 and (peak / avg) >= 3.0 and total >= (w * 10):
                        import numpy as np
                        idx = (col * np.arange(w, dtype='float64')).sum() / total
                        center_x = float(idx / max(1.0, (w - 1)))
                        center_x = max(0.05, min(0.95, center_x))
                        # Low weight so it doesn't overpower real detections
                        person_centers.append((center_x, total * 0.12))
        except Exception:
            pass

        # Upper-body / full-body detection (coarse subject center)
        try:
            body_min_size = (max(48, int(frame_width * 0.12)), max(48, int(frame_height * 0.12)))
            for filename, classifier, conf in body_detectors:
                detected_bodies = classifier.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=2,
                    minSize=body_min_size,
                )
                if detected_bodies is None or len(detected_bodies) == 0:
                    continue

                # Prefer the largest body box for this frame
                best = None
                best_area = 0
                for (x, y, w, h) in detected_bodies:
                    area = int(w) * int(h)
                    if area > best_area:
                        best_area = area
                        best = (x, y, w, h)
                if best is not None and best_area > 0:
                    x, y, w, h = best
                    center_x = (x + (w / 2.0)) / frame_width
                    # Encode area as weight; fold in a detector confidence
                    person_centers.append((float(center_x), float(best_area) * float(conf)))
        except Exception:
            pass

        # Person detection (coarse fallback). Run on a downscaled frame for speed.
        try:
            scale = 640.0 / max(1, frame_width)
            if scale < 1.0:
                resized = cv2.resize(frame, (int(frame_width * scale), int(frame_height * scale)))
            else:
                resized = frame
                scale = 1.0
            rects, weights = hog.detectMultiScale(
                resized,
                winStride=(8, 8),
                padding=(8, 8),
                scale=1.05,
            )
            if rects is not None and len(rects) > 0:
                # Pick the largest detection (by area)
                best = None
                best_area = 0
                for (x, y, w, h) in rects:
                    area = int(w) * int(h)
                    if area > best_area:
                        best_area = area
                        best = (x, y, w, h)
                if best is not None and best_area > 0:
                    x, y, w, h = best
                    # Convert back to original scale
                    x = x / scale
                    w = w / scale
                    center_x = (x + (w / 2.0)) / frame_width
                    person_centers.append((float(center_x), float(best_area)))
        except Exception:
            pass

        # Avoid tiny false positives
        min_size = (max(24, int(frame_width * 0.06)), max(24, int(frame_height * 0.06)))

        # Run all cascades; for profile we also run on a flipped frame
        for filename, classifier, conf in cascades:
            detected = classifier.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=3,
                minSize=min_size,
            )

            for (x, y, w, h) in detected:
                all_faces.append(FaceDetection(
                    x=x / frame_width,
                    y=y / frame_height,
                    w=w / frame_width,
                    h=h / frame_height,
                    confidence=conf,
                ))

            if filename == 'haarcascade_profileface.xml':
                flipped = cv2.flip(gray, 1)
                detected_flipped = classifier.detectMultiScale(
                    flipped,
                    scaleFactor=1.1,
                    minNeighbors=3,
                    minSize=min_size,
                )
                for (x, y, w, h) in detected_flipped:
                    # Convert flipped x back to original coordinate space
                    orig_x = (frame_width - (x + w))
                    all_faces.append(FaceDetection(
                        x=orig_x / frame_width,
                        y=y / frame_height,
                        w=w / frame_width,
                        h=h / frame_height,
                        confidence=conf,
                    ))
    
    cap.release()

    # Prefer face-based detection; fallback to person center when faces not found.
    if all_faces:
        return _determine_position_from_faces(all_faces)

    if person_centers:
        # Area-weighted average center
        total_area = sum(max(1.0, a) for _, a in person_centers)
        avg_center_x = sum(cx * max(1.0, a) for cx, a in person_centers) / total_area

        if avg_center_x < 0.38:
            position = 'left'
        elif avg_center_x > 0.62:
            position = 'right'
        else:
            position = 'center'

        return SpeakerPosition(
            position=position,
            confidence=0.45,
            face_center_x=float(avg_center_x),
            num_faces=0,
        )

    return _determine_position_from_faces(all_faces)


def _detect_with_ffmpeg_fallback(
    video_path: str,
    start_time: float,
    end_time: float,
) -> SpeakerPosition:
    """
    Fallback when OpenCV not available.
    Returns center position as we can't detect faces.
    """
    return SpeakerPosition(
        position='center',
        confidence=0.3,
        face_center_x=0.5,
        num_faces=0,
    )


def _determine_position_from_faces(faces: List[FaceDetection]) -> SpeakerPosition:
    """Determine speaker position from detected faces."""
    if not faces:
        return SpeakerPosition(
            position='center',
            confidence=0.3,
            face_center_x=0.5,
            num_faces=0,
        )
    
    # Get average face center weighted by confidence * area.
    # This reduces the influence of small false positives.
    total_weight = sum(f.confidence * max(1e-6, (f.w * f.h)) for f in faces)
    if total_weight == 0:
        avg_center_x = 0.5
    else:
        avg_center_x = sum(
            f.center_x * (f.confidence * max(1e-6, (f.w * f.h)))
            for f in faces
        ) / total_weight
    
    # Determine position based on horizontal center
    # Left third: 0 - 0.33
    # Center third: 0.33 - 0.67
    # Right third: 0.67 - 1.0
    if avg_center_x < 0.38:
        position = 'left'
    elif avg_center_x > 0.62:
        position = 'right'
    else:
        position = 'center'
    
    # Confidence is higher when:
    # 1. More faces detected (consistent detection)
    # 2. Faces have high detection confidence
    # 3. Position is clearly not center (more extreme = more confident)
    # Recompute average confidence independent of area-weighted total
    avg_confidence = (sum(f.confidence for f in faces) / len(faces)) if faces else 0
    position_clarity = abs(avg_center_x - 0.5) * 2  # 0 at center, 1 at edges
    
    confidence = min(0.95, avg_confidence * 0.6 + position_clarity * 0.3 + min(len(faces) / 10, 0.1))
    
    return SpeakerPosition(
        position=position,
        confidence=confidence,
        face_center_x=avg_center_x,
        num_faces=len(faces),
    )


def _get_face_model_path() -> Optional[Dict[str, str]]:
    """Get path to DNN face detection model files."""
    # Common locations for the model files
    possible_dirs = [
        os.path.dirname(__file__),
        os.path.join(os.path.dirname(__file__), 'models'),
        os.path.expanduser('~/.podflow/models'),
    ]
    
    for dir_path in possible_dirs:
        prototxt = os.path.join(dir_path, 'deploy.prototxt')
        caffemodel = os.path.join(dir_path, 'res10_300x300_ssd_iter_140000.caffemodel')
        
        if os.path.exists(prototxt) and os.path.exists(caffemodel):
            return {'prototxt': prototxt, 'caffemodel': caffemodel}
    
    return None


def detect_faces_for_clips(
    video_path: str,
    clips: List[Dict[str, Any]],
    progress_callback=None,
) -> List[Dict[str, Any]]:
    """
    Detect speaker positions for multiple clips.
    
    Args:
        video_path: Path to video file
        clips: List of clips with startTime and endTime
        progress_callback: Optional callback(percent, message)
        
    Returns:
        List of clips with added speakerPosition field
    """
    results = []
    total = len(clips)
    
    for i, clip in enumerate(clips):
        if progress_callback:
            progress_callback(
                int((i / total) * 100),
                f"Detecting speaker position {i+1}/{total}"
            )
        
        start_time = clip.get('startTime', 0)
        end_time = clip.get('endTime', start_time + 30)
        
        position = detect_speaker_position_for_clip(
            video_path,
            start_time,
            end_time,
            num_samples=5,
        )
        
        clip_result = clip.copy()
        clip_result['speakerPosition'] = position.position
        clip_result['speakerPositionConfidence'] = position.confidence
        clip_result['speakerPositionData'] = position.to_dict()
        
        results.append(clip_result)
    
    return results
