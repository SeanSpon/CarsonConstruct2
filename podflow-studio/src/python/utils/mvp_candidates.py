"""
MVP Candidate Proposer Module

This module generates candidate clip windows around detected peaks
and snaps them to transcript sentence boundaries.

Candidate Event Schema (candidates.json):
{
  "candidates": [
    {
      "type": "energy_spike",
      "t_peak": 542.3,
      "start": 539.8,
      "end": 546.2,
      "meta": {
        "baseline_db": -24.1,
        "peak_db": -11.3,
        "sustained_s": 1.2
      }
    },
    ...
  ]
}

Candidate types: energy_spike, silence_to_spike, laughter_like
"""

from typing import List, Tuple, Optional
import numpy as np

from .sentence_boundary import detect_sentence_boundaries


def _sorted_sentence_boundary_times(transcript: dict) -> List[float]:
    boundaries = detect_sentence_boundaries(transcript or {})
    times = [float(b.time) for b in boundaries if b.boundary_type in ("sentence", "topic", "clause")]
    times.sort()
    return times


def _prev_boundary(boundary_times: List[float], t: float) -> Optional[float]:
    prev = None
    for bt in boundary_times:
        if bt <= t:
            prev = bt
        else:
            break
    return prev


def _next_boundary(boundary_times: List[float], t: float) -> Optional[float]:
    for bt in boundary_times:
        if bt >= t:
            return bt
    return None


def snap_to_sentence_boundaries(
    clip_start: float,
    clip_end: float,
    transcript: dict,
    duration: float,
    max_search_s: float = 6.0,
) -> Tuple[Optional[float], Optional[float], bool, str]:
    """Snap start/end so clips start/end at natural sentence boundaries.

    Uses detected *sentence end* boundary timestamps as safe cut points.
    Start snaps to the nearest boundary at-or-before clip_start.
    End snaps to the nearest boundary at-or-after clip_end.

    Returns (new_start, new_end, snapped, reason). If boundaries are unavailable
    (or we can't find a boundary within max_search_s), returns (None, None, False, reason).
    """
    boundary_times = _sorted_sentence_boundary_times(transcript)
    if not boundary_times:
        return None, None, False, "no_sentence_boundaries"

    start_bt = _prev_boundary(boundary_times, clip_start)
    end_bt = _next_boundary(boundary_times, clip_end)

    if start_bt is None or end_bt is None:
        return None, None, False, "no_boundary_match"

    if abs(clip_start - start_bt) > max_search_s or abs(end_bt - clip_end) > max_search_s:
        return None, None, False, "boundary_too_far"

    new_start = max(0.0, float(start_bt))
    new_end = min(float(duration), float(end_bt))
    if new_end <= new_start:
        return None, None, False, "invalid_boundary_window"

    snapped = (abs(new_start - clip_start) > 1e-6) or (abs(new_end - clip_end) > 1e-6)
    return new_start, new_end, snapped, "sentence_boundaries"


def snap_to_segment_boundary(
    target_time: float,
    transcript: dict,
    direction: str,  # "backward" or "forward"
    max_adjust: float = 2.0
) -> Tuple[float, bool, str]:
    """
    Snap to nearest transcript segment boundary within max_adjust seconds.
    
    Args:
        target_time: The time to snap from
        transcript: Whisper transcript with 'segments' list
        direction: "backward" to find segment starts, "forward" to find segment ends
        max_adjust: Maximum seconds to adjust
        
    Returns:
        Tuple of (snapped_time, was_snapped, snap_reason)
    """
    segments = transcript.get("segments", [])
    
    if not segments:
        return target_time, False, "no_segments"
    
    best = target_time
    best_dist = max_adjust + 1
    snap_reason = "no_match"
    
    for seg in segments:
        if direction == "backward":
            # Prefer segment starts before target (snap clip start to sentence start)
            boundary = seg.get("start", 0)
            if boundary <= target_time:
                dist = target_time - boundary
                if dist <= max_adjust and dist < best_dist:
                    best = boundary
                    best_dist = dist
                    snap_reason = "start_to_sentence"
        else:  # forward
            # Prefer segment ends after target (snap clip end to sentence end)
            boundary = seg.get("end", 0)
            if boundary >= target_time:
                dist = boundary - target_time
                if dist <= max_adjust and dist < best_dist:
                    best = boundary
                    best_dist = dist
                    snap_reason = "end_to_sentence"
    
    was_snapped = best != target_time
    if not was_snapped:
        snap_reason = "no_match"
    
    return best, was_snapped, snap_reason


def propose_clip_windows(
    candidate: dict,
    transcript: dict,
    duration: float,
    clip_lengths: List[int] = None,
    min_clip: float = 8,
    max_clip: float = 300,
    snap_window_s: float = 2.0,
    start_padding_s: float = 0.6,
    end_padding_s: float = 0.8
) -> List[Tuple[float, float, bool, str]]:
    """
    Generate candidate clip windows around peak, snapped to sentence boundaries.
    
    Args:
        candidate: Candidate dict with 't_peak', 'type', 'start', 'end'
        transcript: Whisper transcript dict
        duration: Total video duration
        clip_lengths: List of lengths to try (seconds), default [30, 45, 60, 90, 120]
        min_clip: Minimum clip duration (default 8s)
        max_clip: Maximum clip duration (default 300s)
        snap_window_s: Max adjustment for sentence snapping
        start_padding_s: Padding before clip start
        end_padding_s: Padding after clip end
        
    Returns:
        List of (start, end, snapped, snap_reason) tuples
    """
    if clip_lengths is None:
        clip_lengths = [30, 45, 60, 90, 120]
    
    t_peak = candidate.get("t_peak", candidate.get("start", 0))
    
    # Bias slightly after peak for payoff (reaction happens after moment)
    center = t_peak + 1.0
    
    proposals = []
    seen_ranges = set()  # Avoid duplicate windows
    
    for L in clip_lengths:
        # Position clip so peak is roughly 40% through (more content before+after, not centered on peak)
        raw_start = center - L * 0.40
        raw_end = center + L * 0.60
        
        # Snap to transcript boundaries
        snapped_start, start_snapped, start_reason = snap_to_segment_boundary(
            raw_start, transcript, direction="backward", max_adjust=snap_window_s
        )
        snapped_end, end_snapped, end_reason = snap_to_segment_boundary(
            raw_end, transcript, direction="forward", max_adjust=snap_window_s
        )
        
        # Apply padding
        snapped_start = max(0, snapped_start - start_padding_s)
        snapped_end = min(duration, snapped_end + end_padding_s)

        # Hard rule: prefer sentence-safe boundaries (prevents mid-sentence cuts).
        sent_start, sent_end, sent_snapped, sent_reason = snap_to_sentence_boundaries(
            snapped_start,
            snapped_end,
            transcript,
            duration,
            max_search_s=max(4.0, float(snap_window_s) * 2.0),
        )
        if sent_start is not None and sent_end is not None:
            snapped_start, snapped_end = sent_start, sent_end
        else:
            # Keep the segment-snapped window, but annotate why sentence snapping failed.
            # Downstream scoring can reject these in deterministic mode.
            sent_snapped = False
        
        # Validate clip duration
        clip_duration = snapped_end - snapped_start
        
        if clip_duration < min_clip:
            continue
        
        if clip_duration > max_clip:
            snapped_end = snapped_start + max_clip
        
        # Round for consistency
        snapped_start = round(snapped_start, 2)
        snapped_end = round(snapped_end, 2)
        
        # Deduplicate similar windows (within 1s)
        range_key = (int(snapped_start), int(snapped_end))
        if range_key in seen_ranges:
            continue
        seen_ranges.add(range_key)
        
        # Determine snapping status
        was_snapped = start_snapped or end_snapped or sent_snapped
        if sent_start is not None and sent_end is not None:
            snap_reason = sent_reason
        elif start_snapped and end_snapped:
            snap_reason = "both_snapped"
        elif start_snapped:
            snap_reason = start_reason
        elif end_snapped:
            snap_reason = end_reason
        else:
            snap_reason = "no_snap"
        
        proposals.append((snapped_start, snapped_end, was_snapped, snap_reason))
    
    return proposals


def detect_energy_spikes(
    features: dict,
    bounds: dict,
    settings: dict
) -> List[dict]:
    """
    Detect energy spike candidates from features.
    
    Energy spike: RMS significantly above local baseline.
    
    Args:
        features: Feature dict with 'times', 'rms_db', 'baseline_db'
        bounds: Dict with 'start_time', 'end_time', 'min_duration', 'max_duration'
        settings: Settings dict with thresholds
        
    Returns:
        List of candidate dicts
    """
    times = np.array(features.get("times", []))
    rms_db = np.array(features.get("rms_db", []))
    baseline_db = np.array(features.get("baseline_db", rms_db))
    
    start_time = bounds.get("start_time", 0)
    end_time = bounds.get("end_time", len(times) * 0.1 if len(times) > 0 else 0)
    
    spike_threshold_db = settings.get("spike_threshold_db", 8.0)
    spike_sustain_s = settings.get("spike_sustain_s", 0.7)
    
    # Find frames within bounds
    mask = (times >= start_time) & (times <= end_time)
    
    candidates = []
    in_spike = False
    spike_start = 0
    spike_frames = []
    
    for i, (t, rms, baseline) in enumerate(zip(times, rms_db, baseline_db)):
        if not mask[i]:
            continue
        
        delta = rms - baseline
        
        if delta >= spike_threshold_db:
            if not in_spike:
                in_spike = True
                spike_start = t
                spike_frames = [i]
            else:
                spike_frames.append(i)
        else:
            if in_spike:
                # End of spike
                spike_end = times[spike_frames[-1]] if spike_frames else t
                spike_duration = spike_end - spike_start
                
                if spike_duration >= spike_sustain_s:
                    # Find peak within spike
                    spike_rms = rms_db[spike_frames]
                    peak_idx = spike_frames[np.argmax(spike_rms)]
                    
                    candidates.append({
                        "type": "energy_spike",
                        "t_peak": float(times[peak_idx]),
                        "start": float(spike_start),
                        "end": float(spike_end),
                        "meta": {
                            "baseline_db": float(np.mean(baseline_db[spike_frames])),
                            "peak_db": float(np.max(spike_rms)),
                            "sustained_s": float(spike_duration),
                        }
                    })
                
                in_spike = False
                spike_frames = []
    
    return candidates


def detect_silence_to_spike(
    features: dict,
    bounds: dict,
    settings: dict
) -> List[dict]:
    """
    Detect silence-to-spike (payoff) candidates.
    
    Payoff: A period of silence/low energy followed by a significant spike.
    This is the classic "dramatic pause" pattern.
    
    Args:
        features: Feature dict with 'times', 'rms_db', 'baseline_db'
        bounds: Dict with 'start_time', 'end_time'
        settings: Settings dict with thresholds
        
    Returns:
        List of candidate dicts
    """
    times = np.array(features.get("times", []))
    rms_db = np.array(features.get("rms_db", []))
    baseline_db = np.array(features.get("baseline_db", rms_db))
    
    start_time = bounds.get("start_time", 0)
    end_time = bounds.get("end_time", len(times) * 0.1 if len(times) > 0 else 0)
    
    silence_threshold_db = settings.get("silence_threshold_db", -35)
    silence_run_s = settings.get("silence_run_s", 1.2)
    contrast_window_s = settings.get("contrast_window_s", 2.0)
    spike_threshold_db = settings.get("spike_threshold_db", 8.0)
    
    hop_s = settings.get("hop_s", 0.1)
    silence_frames = int(silence_run_s / hop_s)
    contrast_frames = int(contrast_window_s / hop_s)
    
    candidates = []
    
    # Find silence regions
    silence_mask = rms_db < silence_threshold_db
    
    i = 0
    while i < len(times) - silence_frames - contrast_frames:
        t = times[i]
        
        if t < start_time or t > end_time:
            i += 1
            continue
        
        # Check for silence run
        if silence_mask[i:i + silence_frames].all():
            silence_start = times[i]
            
            # Find end of silence
            j = i + silence_frames
            while j < len(times) and silence_mask[j]:
                j += 1
            
            if j >= len(times):
                break
            
            silence_end = times[j]
            silence_len = silence_end - silence_start
            
            # Check for spike after silence
            spike_window = min(j + contrast_frames, len(times))
            post_silence_rms = rms_db[j:spike_window]
            post_silence_baseline = baseline_db[j:spike_window]
            
            if len(post_silence_rms) > 0:
                max_delta = np.max(post_silence_rms - post_silence_baseline)
                
                if max_delta >= spike_threshold_db:
                    peak_idx = j + np.argmax(post_silence_rms)
                    
                    candidates.append({
                        "type": "silence_to_spike",
                        "t_peak": float(times[peak_idx]),
                        "start": float(silence_start),
                        "end": float(times[spike_window - 1]) if spike_window > 0 else float(times[peak_idx]),
                        "meta": {
                            "silence_start": float(silence_start),
                            "silence_end": float(silence_end),
                            "silence_len": float(silence_len),
                            "peak_db": float(np.max(post_silence_rms)),
                            "baseline_db": float(np.mean(post_silence_baseline)),
                        }
                    })
            
            i = j + 1
        else:
            i += 1
    
    return candidates


def detect_laughter_like(
    features: dict,
    bounds: dict,
    settings: dict
) -> List[dict]:
    """
    Detect laughter-like candidates (burst patterns).
    
    Laughter: Multiple short bursts of high energy with brief gaps.
    
    Args:
        features: Feature dict with 'times', 'rms_db', 'z_rms' (optional)
        bounds: Dict with 'start_time', 'end_time'
        settings: Settings dict with thresholds
        
    Returns:
        List of candidate dicts
    """
    times = np.array(features.get("times", []))
    rms_db = np.array(features.get("rms_db", []))
    
    # Use z-score if available
    if "z_rms" in features:
        z_rms = np.array(features["z_rms"])
    else:
        mean_rms = np.mean(rms_db)
        std_rms = np.std(rms_db) + 1e-6
        z_rms = (rms_db - mean_rms) / std_rms
    
    start_time = bounds.get("start_time", 0)
    end_time = bounds.get("end_time", len(times) * 0.1 if len(times) > 0 else 0)
    
    laughter_z_rms = settings.get("laughter_z_rms", 1.5)
    laughter_gap_s = settings.get("laughter_gap_s", 0.3)
    laughter_min_s = settings.get("laughter_min_s", 1.0)
    
    hop_s = settings.get("hop_s", 0.1)
    max_gap_frames = int(laughter_gap_s / hop_s)
    
    candidates = []
    
    # Find high-energy frames
    burst_mask = z_rms > laughter_z_rms
    
    # Group bursts that are close together
    bursts = []
    in_burst = False
    burst_start = 0
    burst_frames = []
    
    for i, (t, is_burst) in enumerate(zip(times, burst_mask)):
        if t < start_time or t > end_time:
            continue
        
        if is_burst:
            if not in_burst:
                in_burst = True
                burst_start = i
                burst_frames = [i]
            else:
                burst_frames.append(i)
        else:
            if in_burst:
                # Check if this gap is short enough to continue
                if i < len(times) - 1:
                    next_bursts = burst_mask[i:min(i + max_gap_frames + 1, len(times))]
                    if next_bursts.any():
                        # Continue looking
                        continue
                
                # End of burst cluster
                if len(burst_frames) > 0:
                    bursts.append({
                        "start": times[burst_frames[0]],
                        "end": times[burst_frames[-1]],
                        "frames": burst_frames,
                    })
                
                in_burst = False
                burst_frames = []
    
    # Merge nearby bursts into laughter candidates
    i = 0
    while i < len(bursts):
        cluster = [bursts[i]]
        
        # Merge bursts within gap threshold
        j = i + 1
        while j < len(bursts):
            gap = bursts[j]["start"] - cluster[-1]["end"]
            if gap <= laughter_gap_s * 3:  # Allow slightly larger gaps between burst groups
                cluster.append(bursts[j])
                j += 1
            else:
                break
        
        # Check if cluster is long enough
        total_burst_time = sum(b["end"] - b["start"] for b in cluster)
        
        if total_burst_time >= laughter_min_s:
            # Find peak
            all_frames = [f for b in cluster for f in b["frames"]]
            peak_idx = all_frames[np.argmax(z_rms[all_frames])]
            
            candidates.append({
                "type": "laughter_like",
                "t_peak": float(times[peak_idx]),
                "start": float(cluster[0]["start"]),
                "end": float(cluster[-1]["end"]),
                "meta": {
                    "burst_count": len(cluster),
                    "total_burst_s": float(total_burst_time),
                }
            })
        
        i = j
    
    return candidates


def detect_all_candidates(
    features: dict,
    bounds: dict,
    settings: dict
) -> List[dict]:
    """
    Run all candidate detectors and merge results.
    
    Args:
        features: Feature dict
        bounds: Analysis bounds
        settings: Detection settings
        
    Returns:
        List of all candidate dicts
    """
    candidates = []
    
    # Detect each type
    candidates.extend(detect_energy_spikes(features, bounds, settings))
    candidates.extend(detect_silence_to_spike(features, bounds, settings))
    candidates.extend(detect_laughter_like(features, bounds, settings))
    
    # Sort by t_peak
    candidates.sort(key=lambda c: c.get("t_peak", 0))
    
    return candidates


def candidates_to_json(candidates: List[dict]) -> dict:
    """
    Convert candidates list to JSON-serializable format.
    
    Args:
        candidates: List of candidate dicts
        
    Returns:
        JSON-serializable dict with 'candidates' array
    """
    return {
        "candidates": [
            {
                "type": c.get("type", "unknown"),
                "t_peak": round(c.get("t_peak", 0), 2),
                "start": round(c.get("start", 0), 2),
                "end": round(c.get("end", 0), 2),
                "meta": c.get("meta", {}),
            }
            for c in candidates
        ]
    }


def candidates_from_json(data: dict) -> List[dict]:
    """
    Load candidates from JSON format.
    
    Args:
        data: JSON data from candidates_to_json
        
    Returns:
        List of candidate dicts
    """
    return data.get("candidates", [])
