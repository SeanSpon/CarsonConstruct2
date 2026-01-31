"""
Utilities for VAD-based speech segmentation and boundary snapping.

Enhanced with:
- Word-level boundary detection using Whisper timestamps
- Sentence boundary detection for natural cut points
- Mid-word cut prevention
"""

from typing import Iterable, List, Optional, Tuple, Dict, Any

import numpy as np

from utils.baseline import rolling_median


SpeechSegment = Tuple[float, float]

# Minimum padding after word ends (seconds)
WORD_END_PADDING = 0.2
# Minimum padding before word starts (seconds) 
WORD_START_PADDING = 0.15
# Sentence end punctuation
SENTENCE_END_PUNCT = {'.', '!', '?'}
# Clause boundary punctuation
CLAUSE_PUNCT = {',', ';', ':'}


class WordBoundary:
    """Represents a word with timing information."""
    
    def __init__(self, word: str, start: float, end: float, confidence: float = 1.0):
        self.word = word
        self.start = start
        self.end = end
        self.confidence = confidence
        
        # Detect if word ends a sentence
        stripped = word.strip()
        self.ends_sentence = any(stripped.endswith(p) for p in SENTENCE_END_PUNCT)
        self.ends_clause = any(stripped.endswith(p) for p in CLAUSE_PUNCT)
    
    @property
    def duration(self) -> float:
        return self.end - self.start
    
    def safe_cut_after(self) -> float:
        """Get safe cut point after this word."""
        return self.end + WORD_END_PADDING
    
    def safe_cut_before(self) -> float:
        """Get safe cut point before this word."""
        return self.start - WORD_START_PADDING


def extract_word_boundaries(transcript: Dict[str, Any]) -> List[WordBoundary]:
    """
    Extract word boundaries from Whisper transcript.
    
    Args:
        transcript: Whisper transcript with 'words' array
        
    Returns:
        List of WordBoundary objects
    """
    words_data = transcript.get('words', [])
    if not words_data:
        # Try to extract from segments if words not available
        segments = transcript.get('segments', [])
        if segments:
            words_data = []
            for seg in segments:
                # Whisper segments sometimes have words
                seg_words = seg.get('words', [])
                if seg_words:
                    words_data.extend(seg_words)
    
    boundaries = []
    for w in words_data:
        word = w.get('word', w.get('text', ''))
        start = w.get('start', 0)
        end = w.get('end', start + 0.1)
        confidence = w.get('confidence', w.get('probability', 1.0))
        
        boundaries.append(WordBoundary(word, start, end, confidence))
    
    return boundaries


def find_word_at_time(
    boundaries: List[WordBoundary],
    time: float,
    tolerance: float = 0.1
) -> Optional[WordBoundary]:
    """
    Find the word that contains or is closest to a given time.
    
    Args:
        boundaries: List of word boundaries
        time: Target time in seconds
        tolerance: Tolerance for finding nearby words
        
    Returns:
        WordBoundary if found, None otherwise
    """
    if not boundaries:
        return None
    
    # First, check if time is inside any word
    for word in boundaries:
        if word.start <= time <= word.end:
            return word
    
    # Find closest word within tolerance
    closest = None
    min_dist = float('inf')
    
    for word in boundaries:
        # Distance to word start or end
        dist_start = abs(word.start - time)
        dist_end = abs(word.end - time)
        dist = min(dist_start, dist_end)
        
        if dist < min_dist and dist <= tolerance:
            min_dist = dist
            closest = word
    
    return closest


def is_mid_word_cut(
    boundaries: List[WordBoundary],
    cut_time: float,
    tolerance: float = 0.05
) -> Tuple[bool, Optional[WordBoundary]]:
    """
    Check if a cut time falls in the middle of a word.
    
    Args:
        boundaries: List of word boundaries
        cut_time: Proposed cut time in seconds
        tolerance: Tolerance for word boundary detection
        
    Returns:
        Tuple of (is_mid_word, affected_word)
    """
    if not boundaries:
        return False, None
    
    for word in boundaries:
        # Check if cut is inside word (with some tolerance at edges)
        inner_start = word.start + tolerance
        inner_end = word.end - tolerance
        
        if inner_start < cut_time < inner_end:
            return True, word
    
    return False, None


def find_safe_cut_point(
    boundaries: List[WordBoundary],
    target_time: float,
    direction: str = "nearest",  # "nearest", "before", "after"
    max_search_window: float = 2.0,
    prefer_sentence_end: bool = True,
) -> float:
    """
    Find a safe cut point that doesn't cut mid-word.
    
    Args:
        boundaries: List of word boundaries
        target_time: Desired cut time
        direction: Search direction ("nearest", "before", "after")
        max_search_window: Maximum distance to search for safe point
        prefer_sentence_end: Prefer cutting at sentence boundaries
        
    Returns:
        Safe cut time
    """
    if not boundaries:
        return target_time
    
    # Check if target is already safe
    is_mid, _ = is_mid_word_cut(boundaries, target_time)
    if not is_mid:
        return target_time
    
    # Find candidate cut points
    candidates = []
    
    for word in boundaries:
        # After word end
        cut_after = word.safe_cut_after()
        if abs(cut_after - target_time) <= max_search_window:
            priority = 0
            if prefer_sentence_end and word.ends_sentence:
                priority = 2  # Highest priority
            elif word.ends_clause:
                priority = 1
            candidates.append((cut_after, priority, "after", word))
        
        # Before word start
        cut_before = word.safe_cut_before()
        if abs(cut_before - target_time) <= max_search_window:
            candidates.append((cut_before, 0, "before", word))
    
    if not candidates:
        return target_time
    
    # Filter by direction
    if direction == "before":
        candidates = [(t, p, d, w) for t, p, d, w in candidates if t <= target_time]
    elif direction == "after":
        candidates = [(t, p, d, w) for t, p, d, w in candidates if t >= target_time]
    
    if not candidates:
        return target_time
    
    # Sort by priority (higher first), then by distance to target
    candidates.sort(key=lambda x: (-x[1], abs(x[0] - target_time)))
    
    return candidates[0][0]


def find_sentence_boundaries(
    boundaries: List[WordBoundary],
    min_time: float = 0.0,
    max_time: float = float('inf'),
) -> List[float]:
    """
    Find natural sentence boundary times.
    
    Args:
        boundaries: List of word boundaries
        min_time: Minimum time to consider
        max_time: Maximum time to consider
        
    Returns:
        List of sentence boundary times
    """
    sentence_ends = []
    
    for word in boundaries:
        if word.ends_sentence and min_time <= word.end <= max_time:
            sentence_ends.append(word.safe_cut_after())
    
    return sentence_ends


def snap_to_word_boundaries(
    start_time: float,
    end_time: float,
    transcript: Optional[Dict[str, Any]],
    prefer_sentence_boundaries: bool = True,
    max_adjustment: float = 1.0,
    add_breathing_room: bool = True,
    head_padding_s: float = 0.15,
    tail_padding_s: float = 0.3,
) -> Tuple[float, float, bool, str]:
    """
    Snap clip boundaries to word boundaries to avoid mid-word cuts,
    with optional breathing room padding for natural feel.
    
    Args:
        start_time: Original start time
        end_time: Original end time
        transcript: Whisper transcript with word timestamps
        prefer_sentence_boundaries: Prefer sentence boundaries when possible
        max_adjustment: Maximum time to adjust boundaries
        add_breathing_room: Add small padding before/after for natural feel
        head_padding_s: Pre-roll padding before clip start (e.g. 0.15s)
        tail_padding_s: Post-roll padding after clip end (e.g. 0.3s)
        
    Returns:
        Tuple of (new_start, new_end, was_snapped, reason)
    """
    if not transcript:
        return start_time, end_time, False, "no_transcript"
    
    boundaries = extract_word_boundaries(transcript)
    if not boundaries:
        return start_time, end_time, False, "no_word_boundaries"
    
    # Check and fix start time
    start_is_mid, start_word = is_mid_word_cut(boundaries, start_time)
    new_start = start_time
    start_adjusted = False
    
    if start_is_mid and start_word:
        # Prefer to start at beginning of word or after previous word
        safe_start = find_safe_cut_point(
            boundaries, start_time,
            direction="before",
            max_search_window=max_adjustment,
            prefer_sentence_end=False,
        )
        if abs(safe_start - start_time) <= max_adjustment:
            new_start = safe_start
            start_adjusted = True
    
    # Check and fix end time
    end_is_mid, end_word = is_mid_word_cut(boundaries, end_time)
    new_end = end_time
    end_adjusted = False
    
    if end_is_mid and end_word:
        # Prefer to end after word or at sentence boundary
        safe_end = find_safe_cut_point(
            boundaries, end_time,
            direction="after",
            max_search_window=max_adjustment,
            prefer_sentence_end=prefer_sentence_boundaries,
        )
        if abs(safe_end - end_time) <= max_adjustment:
            new_end = safe_end
            end_adjusted = True
    
    # Add breathing room padding for natural starts/ends
    if add_breathing_room:
        # Add small pre-roll so clip doesn't start too abruptly
        if head_padding_s > 0:
            new_start = max(0, new_start - head_padding_s)
        
        # Add small post-roll so clip doesn't end too abruptly
        if tail_padding_s > 0:
            new_end = new_end + tail_padding_s
    
    # Determine reason
    was_snapped = start_adjusted or end_adjusted
    if was_snapped:
        if start_adjusted and end_adjusted:
            reason = "both_adjusted"
        elif start_adjusted:
            reason = "start_adjusted"
        else:
            reason = "end_adjusted"
    else:
        reason = "already_safe"
    
    return new_start, new_end, was_snapped, reason


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
    head_padding_s: float = 0.2,
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

    base_start = nearest_boundary(start_time, segment_starts) or start_time
    base_end = nearest_boundary(end_time, segment_ends) or end_time

    # Apply small pre-roll/post-roll so clips don't start/end too abruptly.
    new_start = base_start
    new_end = base_end

    if head_padding_s > 0:
        new_start = new_start - head_padding_s
    if tail_padding_s > 0:
        new_end = new_end + tail_padding_s

    new_start = max(bounds[0], new_start)
    new_end = min(bounds[1], new_end)

    if new_end <= new_start:
        return original[0], original[1], False, "invalid_bounds"

    # Ensure duration stays within constraints. Prefer preserving the (clean) end,
    # and adjust the start if needed.
    duration = new_end - new_start
    if duration > max_duration:
        new_start = max(bounds[0], new_end - max_duration)
        duration = new_end - new_start
    if duration < min_duration:
        return original[0], original[1], False, "duration_out_of_bounds"

    if duration > max_duration:
        return original[0], original[1], False, "duration_out_of_bounds"

    if new_start == start_time and new_end == end_time:
        return new_start, new_end, False, "unchanged"

    return new_start, new_end, True, "snapped"
