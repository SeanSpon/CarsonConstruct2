"""
Utilities for VAD-based speech segmentation and boundary snapping.
"""

from typing import Iterable, List, Optional, Tuple

import numpy as np

from utils.baseline import rolling_median


SpeechSegment = Tuple[float, float]


def _resample_audio(y: np.ndarray, sr: int, target_sr: int) -> np.ndarray:
    if sr == target_sr:
        return y
    import librosa

    return librosa.resample(y, orig_sr=sr, target_sr=target_sr)


def _pcm16_bytes(y: np.ndarray) -> bytes:
    y = np.clip(y, -1.0, 1.0)
    return (y * 32767).astype(np.int16).tobytes()


def _fallback_energy_segments(
    y: np.ndarray,
    sr: int,
    frame_ms: int = 30,
    merge_gap_s: float = 0.25,
) -> List[SpeechSegment]:
    import librosa

    hop_length = int(sr * (frame_ms / 1000.0))
    if hop_length < 1:
        hop_length = 1
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    if rms.size == 0:
        return []
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    baseline = rolling_median(rms, max(3, int(1.0 / (frame_ms / 1000.0))))
    threshold = np.percentile(baseline, 40)
    speech_mask = rms > threshold
    return _segments_from_mask(times, speech_mask, merge_gap_s=merge_gap_s)


def _segments_from_mask(
    times: np.ndarray,
    mask: Iterable[bool],
    merge_gap_s: float,
) -> List[SpeechSegment]:
    segments: List[SpeechSegment] = []
    start: Optional[float] = None
    for time, is_speech in zip(times, mask):
        if is_speech and start is None:
            start = float(time)
        elif not is_speech and start is not None:
            segments.append((start, float(time)))
            start = None
    if start is not None and len(times) > 0:
        segments.append((start, float(times[-1])))

    if not segments:
        return []

    merged = [segments[0]]
    for seg_start, seg_end in segments[1:]:
        last_start, last_end = merged[-1]
        if seg_start - last_end <= merge_gap_s:
            merged[-1] = (last_start, seg_end)
        else:
            merged.append((seg_start, seg_end))
    return merged


def build_vad_segments(
    y: np.ndarray,
    sr: int,
    aggressiveness: int = 2,
    frame_ms: int = 30,
    target_sr: int = 16000,
    merge_gap_s: float = 0.25,
) -> List[SpeechSegment]:
    """
    Build speech segments using WebRTC VAD (fallbacks to energy-based).
    """
    try:
        import webrtcvad
    except Exception:
        return _fallback_energy_segments(y, sr, frame_ms=frame_ms, merge_gap_s=merge_gap_s)

    vad = webrtcvad.Vad()
    vad.set_mode(int(aggressiveness))

    audio = _resample_audio(y, sr, target_sr)
    frame_len = int(target_sr * frame_ms / 1000.0)
    if frame_len < 1:
        return []
    pcm = _pcm16_bytes(audio)
    bytes_per_frame = frame_len * 2
    total_frames = len(pcm) // bytes_per_frame
    if total_frames == 0:
        return []

    mask = []
    times = []
    for i in range(total_frames):
        start = i * bytes_per_frame
        end = start + bytes_per_frame
        frame = pcm[start:end]
        time_start = i * frame_ms / 1000.0
        time_end = (i + 1) * frame_ms / 1000.0
        times.append((time_start + time_end) / 2.0)
        mask.append(vad.is_speech(frame, sample_rate=target_sr))

    return _segments_from_mask(np.asarray(times), mask, merge_gap_s=merge_gap_s)


def build_vad_mask(times: np.ndarray, segments: List[SpeechSegment]) -> np.ndarray:
    """
    Build a boolean speech mask aligned to frame times.
    """
    mask = np.zeros_like(times, dtype=bool)
    if times.size == 0 or not segments:
        return mask
    for start, end in segments:
        mask |= (times >= start) & (times <= end)
    return mask


def snap_clip_to_segments(
    start_time: float,
    end_time: float,
    segments: List[SpeechSegment],
    bounds: Tuple[float, float],
    min_duration: float,
    max_duration: float,
    snap_window_s: float = 2.0,
    tail_padding_s: float = 0.4,
) -> Tuple[float, float, bool, str]:
    """
    Snap clip bounds to nearest speech segment boundaries when close enough.
    """
    original = (start_time, end_time)
    if not segments:
        return start_time, end_time, False, "no_segments"

    segment_starts = [s for s, _ in segments]
    segment_ends = [e for _, e in segments]

    def nearest_boundary(value: float, candidates: List[float]) -> Optional[float]:
        best = None
        best_delta = snap_window_s + 1.0
        for candidate in candidates:
            delta = abs(candidate - value)
            if delta <= snap_window_s and delta < best_delta:
                best = candidate
                best_delta = delta
        return best

    new_start = nearest_boundary(start_time, segment_starts) or start_time
    new_end = nearest_boundary(end_time, segment_ends) or end_time

    new_start = max(bounds[0], new_start)
    new_end = min(bounds[1], new_end)

    if tail_padding_s > 0:
        new_end = min(new_end + tail_padding_s, bounds[1])

    if new_end <= new_start:
        return original[0], original[1], False, "invalid_bounds"

    duration = new_end - new_start
    if duration < min_duration or duration > max_duration:
        return original[0], original[1], False, "duration_out_of_bounds"

    if new_start == start_time and new_end == end_time:
        return new_start, new_end, False, "unchanged"

    return new_start, new_end, True, "snapped"
