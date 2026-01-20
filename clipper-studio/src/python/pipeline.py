#!/usr/bin/env python3
"""
Clipper Studio - Full Pipeline with Validation

input → transcript → detect → render → validate → fix → export

This module provides the unified pipeline that integrates:
1. Detection (existing detector.py)
2. Validation (validate/)
3. Auto-fix (autofix/)
4. Export (future)

The pipeline is deterministic and self-correcting:
- Validation never changes intent
- Fixes only repair mechanical failures
- If a clip still fails after 1 fix pass → discard
"""

import os
import sys
import json
import tempfile
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class PipelineResult:
    """Result of running the full pipeline."""
    success: bool
    clips: List[Dict]
    dropped_clips: List[Dict]
    validation_summary: Dict
    fix_summary: Dict
    waveform: List[float]
    debug: Optional[Dict] = None


def run_pipeline(
    video_path: str,
    min_duration: float = 15.0,
    max_duration: float = 60.0,
    strict: bool = False,
    debug: bool = False,
) -> Dict:
    """
    Run the full detection → validation → fix pipeline.
    
    Args:
        video_path: Path to input video
        min_duration: Minimum clip duration in seconds
        max_duration: Maximum clip duration in seconds
        strict: If True, fail on any validation error (no auto-fix)
        debug: Enable debug output
    
    Returns:
        Dict with clips, waveform, and metadata
    """
    # Import dependencies
    try:
        import librosa
        import numpy as np
    except ImportError as e:
        return {
            "success": False,
            "error": f"Missing dependency: {e}",
            "clips": [],
        }
    
    # Import our modules
    try:
        from features import extract_features
        from patterns.payoff import detect_payoff_moments
        from patterns.monologue import detect_energy_monologues
        from utils.audio import extract_audio, generate_waveform
        from utils.clipworthiness import apply_clipworthiness
        from utils.scoring import calculate_final_scores, select_final_clips
        from vad_utils import snap_clip_to_segments
        from validate import ValidationRunner, ClipValidator
        from autofix import AutoFixRunner
    except ImportError as e:
        return {
            "success": False,
            "error": f"Missing module: {e}",
            "clips": [],
        }
    
    result = {
        "success": True,
        "clips": [],
        "dropped_clips": [],
        "waveform": [],
        "validation": {},
        "autofix": {},
    }
    
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        
        # ========================================
        # STEP 1: Extract audio
        # ========================================
        try:
            extract_audio(video_path, audio_path)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to extract audio: {e}",
                "clips": [],
            }
        
        # Load audio
        try:
            y, sr = librosa.load(audio_path, sr=22050)
            duration = librosa.get_duration(y=y, sr=sr)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load audio: {e}",
                "clips": [],
            }
        
        # ========================================
        # STEP 2: Extract features + VAD
        # ========================================
        feature_settings = {"baseline_window_s": 15.0}
        features = extract_features(y, sr, settings=feature_settings)
        
        bounds = {
            "start_time": 0.0,
            "end_time": duration,
            "min_duration": min_duration,
            "max_duration": max_duration,
        }
        
        # ========================================
        # STEP 3: Detect patterns
        # ========================================
        try:
            payoff_moments = detect_payoff_moments(features, bounds, {"debug": debug})
        except Exception as e:
            payoff_moments = []
            if debug:
                print(f"Payoff detection error: {e}")
        
        try:
            monologue_moments = detect_energy_monologues(features, bounds, {"debug": debug})
        except Exception as e:
            monologue_moments = []
            if debug:
                print(f"Monologue detection error: {e}")
        
        # ========================================
        # STEP 4: Snap boundaries + score
        # ========================================
        all_moments = payoff_moments + monologue_moments
        snapped = []
        
        for moment in all_moments:
            new_start, new_end, snapped_flag, snap_reason = snap_clip_to_segments(
                moment["startTime"],
                moment["endTime"],
                features.get("vad_segments", []),
                (0.0, duration),
                bounds["min_duration"],
                bounds["max_duration"],
                snap_window_s=2.0,
                tail_padding_s=0.4,
            )
            moment["startTime"] = round(new_start, 2)
            moment["endTime"] = round(new_end, 2)
            moment["duration"] = round(new_end - new_start, 2)
            moment["start"] = moment["startTime"]
            moment["end"] = moment["endTime"]
            if debug:
                moment.setdefault("debug", {})
                moment["debug"]["snapApplied"] = snapped_flag
                moment["debug"]["snapReason"] = snap_reason
            snapped.append(moment)
        
        # Apply clipworthiness scoring
        scored_clips, debug_stats = apply_clipworthiness(
            snapped, features, {"debug": debug}, debug=debug
        )
        scored_clips = calculate_final_scores(scored_clips)
        
        # Select final clips
        final_clips = select_final_clips(scored_clips, max_clips=20, min_gap=30)
        
        # ========================================
        # STEP 5: VALIDATE
        # ========================================
        validator = ValidationRunner(
            clip_validator=ClipValidator(
                min_duration=min_duration,
                max_duration=max_duration,
            )
        )
        
        validation_report = validator.validate_batch(
            clips=final_clips,
            transcript_words=None,  # Would need transcript integration
        )
        
        result["validation"] = {
            "total": validation_report.total,
            "valid": validation_report.valid,
            "invalid": validation_report.invalid,
            "fixable": validation_report.fixable,
            "hard_failures": validation_report.hard_failures,
        }
        
        # ========================================
        # STEP 6: AUTO-FIX (if needed and not strict)
        # ========================================
        if validation_report.invalid > 0 and not strict:
            fixer = AutoFixRunner()
            
            # Convert validation reports to error dicts
            validation_dicts = []
            for report in validation_report.reports:
                validation_dicts.append({
                    'valid': report.valid,
                    'errors': [
                        {
                            'code': e.code,
                            'message': e.message,
                            'severity': e.severity.value,
                            'details': e.details,
                        }
                        for e in report.all_errors
                    ],
                })
            
            fix_result = fixer.fix_batch(
                clips=final_clips,
                validation_results=validation_dicts,
                media_duration=duration,
            )
            
            result["autofix"] = {
                "total": fix_result.total,
                "fixed": fix_result.fixed,
                "dropped": fix_result.dropped,
                "passed_through": fix_result.passed_through,
            }
            
            # Collect fixed clips and dropped clips
            fixed_clips = []
            dropped_clips = []
            
            for fix_res in fix_result.results:
                if fix_res.dropped:
                    dropped_clips.append(fix_res.clip)
                else:
                    fixed_clips.append(fix_res.clip)
            
            final_clips = fixed_clips
            result["dropped_clips"] = dropped_clips
        
        # In strict mode, drop any invalid clips
        elif validation_report.invalid > 0 and strict:
            valid_ids = {
                r.clip_id for r in validation_report.reports if r.valid
            }
            dropped = [c for c in final_clips if c.get('id') not in valid_ids]
            final_clips = [c for c in final_clips if c.get('id') in valid_ids]
            result["dropped_clips"] = dropped
            result["autofix"] = {"strict_mode": True, "dropped": len(dropped)}
        
        # ========================================
        # STEP 7: Generate waveform
        # ========================================
        waveform = generate_waveform(y, num_points=1000)
        
        # ========================================
        # STEP 8: Return results
        # ========================================
        result["clips"] = final_clips
        result["waveform"] = waveform
        
        if debug:
            result["debug"] = {
                "gating": debug_stats,
                "duration": duration,
                "payoff_candidates": len(payoff_moments),
                "monologue_candidates": len(monologue_moments),
            }
        
        return result


def run_pipeline_with_output(
    video_path: str,
    output_format: str = "json",
    **kwargs
) -> None:
    """
    Run pipeline and output results to stdout.
    
    This is the entry point for the Electron IPC integration.
    
    Args:
        video_path: Path to input video
        output_format: Output format ('json' or 'progress')
        **kwargs: Additional arguments for run_pipeline
    """
    def send_progress(step: str, progress: int, message: str):
        """Send progress update to stdout."""
        print(json.dumps({
            "type": "progress",
            "step": step,
            "progress": progress,
            "message": message
        }), flush=True)
    
    def send_complete(result: Dict):
        """Send completion message."""
        print(json.dumps({
            "type": "complete",
            **result
        }), flush=True)
    
    def send_error(error: str):
        """Send error message."""
        print(json.dumps({
            "type": "error",
            "error": error
        }), flush=True)
    
    # Run pipeline
    send_progress("pipeline", 0, "Starting pipeline...")
    
    result = run_pipeline(video_path, **kwargs)
    
    if not result.get("success", True):
        send_error(result.get("error", "Unknown error"))
        return
    
    # Report validation status
    validation = result.get("validation", {})
    if validation.get("invalid", 0) > 0:
        send_progress(
            "validation",
            80,
            f"Validation: {validation.get('invalid')} issues found"
        )
    
    # Report auto-fix status
    autofix = result.get("autofix", {})
    if autofix.get("fixed", 0) > 0:
        send_progress(
            "autofix",
            90,
            f"Auto-fix: {autofix.get('fixed')} clips fixed"
        )
    
    if autofix.get("dropped", 0) > 0:
        send_progress(
            "autofix",
            95,
            f"Auto-fix: {autofix.get('dropped')} clips dropped"
        )
    
    send_progress("complete", 100, f"Found {len(result.get('clips', []))} clips")
    send_complete(result)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipeline.py <video_path> [--debug] [--strict]")
        sys.exit(1)
    
    video_path = sys.argv[1]
    debug_flag = "--debug" in sys.argv
    strict_flag = "--strict" in sys.argv
    
    if not os.path.exists(video_path):
        print(json.dumps({"type": "error", "error": f"File not found: {video_path}"}))
        sys.exit(1)
    
    run_pipeline_with_output(video_path, debug=debug_flag, strict=strict_flag)
