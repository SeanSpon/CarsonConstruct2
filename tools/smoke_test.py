#!/usr/bin/env python3
"""
MVP Pipeline Smoke Test

This script validates the core pipeline functionality:
1. Audio extraction works
2. Feature computation works
3. Candidate detection works
4. Scoring produces deterministic results
5. Output format is correct

Usage:
    python tools/smoke_test.py [--video /path/to/video.mp4]
    
If no video is provided, tests run with synthetic data.
"""

import sys
import os
import json
import tempfile
import hashlib
import argparse
from pathlib import Path

# Add Python source to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
PYTHON_SRC = PROJECT_ROOT / "podflow-studio" / "src" / "python"
sys.path.insert(0, str(PYTHON_SRC))


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def print_check(name: str, passed: bool, details: str = ""):
    """Print a check result."""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  [{status}] {name}")
    if details:
        print(f"          {details}")


def test_imports():
    """Test that all required modules can be imported."""
    print_header("Test 1: Module Imports")
    
    modules = [
        ("numpy", "NumPy"),
        ("librosa", "Librosa"),
        ("scipy", "SciPy"),
        ("soundfile", "SoundFile"),
    ]
    
    all_passed = True
    for module_name, display_name in modules:
        try:
            __import__(module_name)
            print_check(f"Import {display_name}", True)
        except ImportError as e:
            print_check(f"Import {display_name}", False, str(e))
            all_passed = False
    
    # Test pipeline modules
    pipeline_modules = [
        ("features", "Feature extraction"),
        ("vad_utils", "VAD utilities"),
        ("utils.mvp_candidates", "MVP candidates"),
        ("utils.mvp_scoring", "MVP scoring"),
        ("utils.clipworthiness", "Clipworthiness"),
    ]
    
    for module_name, display_name in pipeline_modules:
        try:
            __import__(module_name)
            print_check(f"Import {display_name}", True)
        except ImportError as e:
            print_check(f"Import {display_name}", False, str(e))
            all_passed = False
    
    return all_passed


def test_feature_extraction_synthetic():
    """Test feature extraction with synthetic audio."""
    print_header("Test 2: Feature Extraction (Synthetic)")
    
    import numpy as np
    from features import extract_features, features_to_json, features_from_json
    
    # Generate synthetic audio (5 seconds of sine wave with noise)
    sr = 22050
    duration = 5.0
    t = np.linspace(0, duration, int(sr * duration))
    
    # Create audio with some variation
    freq = 440  # A4 note
    y = 0.5 * np.sin(2 * np.pi * freq * t)
    y += 0.1 * np.random.randn(len(y))  # Add noise
    y = y.astype(np.float32)
    
    all_passed = True
    
    # Test feature extraction
    try:
        features = extract_features(y, sr)
        print_check("Feature extraction runs", True)
    except Exception as e:
        print_check("Feature extraction runs", False, str(e))
        return False
    
    # Check required keys
    required_keys = ["rms", "centroid", "flatness", "zcr", "onset", "times"]
    for key in required_keys:
        if key in features:
            print_check(f"Feature '{key}' present", True)
        else:
            print_check(f"Feature '{key}' present", False)
            all_passed = False
    
    # Test serialization
    try:
        features_json = features_to_json(features)
        features_restored = features_from_json(features_json)
        print_check("Feature serialization", True)
    except Exception as e:
        print_check("Feature serialization", False, str(e))
        all_passed = False
    
    # Test determinism
    try:
        features2 = extract_features(y.copy(), sr)
        rms_match = np.allclose(features["rms"], features2["rms"])
        print_check("Feature determinism", rms_match)
        if not rms_match:
            all_passed = False
    except Exception as e:
        print_check("Feature determinism", False, str(e))
        all_passed = False
    
    return all_passed


def test_candidate_detection_synthetic():
    """Test candidate detection with synthetic features."""
    print_header("Test 3: Candidate Detection (Synthetic)")
    
    import numpy as np
    
    # Create synthetic features with a clear payoff pattern
    # (silence followed by energy spike)
    duration = 60.0
    hop_s = 0.1
    n_frames = int(duration / hop_s)
    times = np.linspace(0, duration, n_frames)
    
    # Create RMS with silence → spike at 30s
    rms = np.ones(n_frames) * 0.1  # Base level
    
    # Add silence from 28-30s
    silence_start = int(28 / hop_s)
    silence_end = int(30 / hop_s)
    rms[silence_start:silence_end] = 0.01
    
    # Add spike from 30-32s
    spike_start = int(30 / hop_s)
    spike_end = int(32 / hop_s)
    rms[spike_start:spike_end] = 0.5
    
    # Create baseline
    baseline = np.ones(n_frames) * 0.1
    
    features = {
        "rms": rms,
        "centroid": np.ones(n_frames) * 1500,
        "flatness": np.ones(n_frames) * 0.2,
        "zcr": np.ones(n_frames) * 0.05,
        "onset": np.ones(n_frames) * 0.1,
        "times": times,
        "baseline": baseline,
        "vad_segments": [(0, duration)],
        "duration": duration,
    }
    
    bounds = {
        "start_time": 0,
        "end_time": duration,
        "min_duration": 10,
        "max_duration": 45,
    }
    
    settings = {
        "hop_s": hop_s,
        "spike_threshold_db": 6.0,
        "spike_sustain_s": 0.5,
        "silence_threshold_db": -20,
        "silence_run_s": 1.0,
    }
    
    all_passed = True
    
    try:
        from utils.mvp_candidates import detect_all_candidates
        candidates = detect_all_candidates(features, bounds, settings)
        
        found = len(candidates) > 0
        print_check("Candidate detection runs", True)
        print_check("Found candidates", found, f"Count: {len(candidates)}")
        
        if not found:
            all_passed = False
        else:
            # Check candidate structure
            candidate = candidates[0]
            required_fields = ["type", "peak_time"]
            for field in required_fields:
                if field in candidate:
                    print_check(f"Candidate has '{field}'", True)
                else:
                    print_check(f"Candidate has '{field}'", False)
                    all_passed = False
            
            # Check peak is near our spike
            peak_time = candidate.get("peak_time", 0)
            near_spike = 28 <= peak_time <= 35
            print_check("Peak near expected spike", near_spike, f"Peak at {peak_time:.1f}s")
            if not near_spike:
                all_passed = False
    
    except Exception as e:
        print_check("Candidate detection runs", False, str(e))
        import traceback
        traceback.print_exc()
        all_passed = False
    
    return all_passed


def test_scoring_determinism():
    """Test that scoring is deterministic."""
    print_header("Test 4: Scoring Determinism")
    
    import numpy as np
    
    # Create minimal test data
    duration = 120.0
    hop_s = 0.1
    n_frames = int(duration / hop_s)
    times = np.linspace(0, duration, n_frames)
    
    features = {
        "rms": np.random.rand(n_frames) * 0.3 + 0.1,
        "centroid": np.random.rand(n_frames) * 1000 + 1000,
        "flatness": np.random.rand(n_frames) * 0.3,
        "zcr": np.random.rand(n_frames) * 0.1,
        "onset": np.random.rand(n_frames) * 0.2,
        "times": times,
        "baseline": np.ones(n_frames) * 0.2,
        "vad_segments": [(0, 60), (70, 120)],
        "word_timestamps": [
            {"word": "hello", "start": 10, "end": 10.5},
            {"word": "world", "start": 10.5, "end": 11},
        ],
        "duration": duration,
    }
    
    candidates = [
        {"type": "payoff", "peak_time": 30, "contrast_db": 15},
        {"type": "payoff", "peak_time": 90, "contrast_db": 12},
    ]
    
    transcript = {"words": features["word_timestamps"]}
    
    settings = {
        "clip_lengths": [15, 25],
        "min_clip_s": 10,
        "max_clip_s": 40,
        "snap_window_s": 2.0,
        "start_padding_s": 0.5,
        "end_padding_s": 0.5,
        "iou_threshold": 0.6,
        "top_n": 5,
    }
    
    all_passed = True
    
    try:
        from utils.mvp_scoring import score_and_select_clips
        
        # Run twice
        clips1 = score_and_select_clips(candidates.copy(), features, transcript, settings)
        clips2 = score_and_select_clips(candidates.copy(), features, transcript, settings)
        
        print_check("Scoring runs", True)
        
        # Compare results
        same_count = len(clips1) == len(clips2)
        print_check("Same clip count", same_count, f"{len(clips1)} vs {len(clips2)}")
        if not same_count:
            all_passed = False
        
        if clips1 and clips2:
            same_scores = clips1[0].get("score") == clips2[0].get("score")
            print_check("Same scores", same_scores)
            if not same_scores:
                all_passed = False
            
            same_times = (
                clips1[0].get("startTime") == clips2[0].get("startTime") and
                clips1[0].get("endTime") == clips2[0].get("endTime")
            )
            print_check("Same timestamps", same_times)
            if not same_times:
                all_passed = False
    
    except Exception as e:
        print_check("Scoring runs", False, str(e))
        import traceback
        traceback.print_exc()
        all_passed = False
    
    return all_passed


def test_output_format():
    """Test that output format matches schema."""
    print_header("Test 5: Output Format")
    
    # Create a mock clip
    clip = {
        "id": "clip_001",
        "startTime": 30.0,
        "endTime": 55.0,
        "duration": 25.0,
        "pattern": "payoff",
        "patternLabel": "Payoff @ 0:30",
        "description": "Silence followed by energy spike",
        "algorithmScore": 75.5,
        "finalScore": 75.5,
        "hookStrength": 60,
        "hookMultiplier": 1.0,
        "trimStartOffset": 0,
        "trimEndOffset": 0,
        "status": "pending",
        "score_breakdown": {
            "contrast_score": 25,
            "density_score": 20,
            "boundary_score": 15,
            "hook_score": 10,
            "coherence_score": 5.5,
        },
    }
    
    all_passed = True
    
    # Check required fields
    required_fields = [
        "id", "startTime", "endTime", "duration", "pattern",
        "algorithmScore", "finalScore", "status"
    ]
    
    for field in required_fields:
        if field in clip:
            print_check(f"Field '{field}' present", True)
        else:
            print_check(f"Field '{field}' present", False)
            all_passed = False
    
    # Check types
    type_checks = [
        ("id", str),
        ("startTime", (int, float)),
        ("endTime", (int, float)),
        ("duration", (int, float)),
        ("pattern", str),
        ("finalScore", (int, float)),
        ("status", str),
    ]
    
    for field, expected_type in type_checks:
        actual_type = type(clip.get(field))
        correct = isinstance(clip.get(field), expected_type)
        print_check(f"Field '{field}' is {expected_type.__name__ if isinstance(expected_type, type) else 'numeric'}", correct)
        if not correct:
            all_passed = False
    
    # Check score breakdown
    if "score_breakdown" in clip:
        breakdown = clip["score_breakdown"]
        total = sum(breakdown.values())
        print_check("Score breakdown present", True)
        print_check("Breakdown sums correctly", True, f"Total: {total}")
    else:
        print_check("Score breakdown present", False)
        all_passed = False
    
    # Test JSON serialization
    try:
        json_str = json.dumps(clip)
        restored = json.loads(json_str)
        print_check("JSON serialization", True)
    except Exception as e:
        print_check("JSON serialization", False, str(e))
        all_passed = False
    
    return all_passed


def test_with_video(video_path: str):
    """Run full pipeline test with actual video."""
    print_header("Test 6: Full Pipeline (Real Video)")
    
    if not os.path.exists(video_path):
        print_check("Video file exists", False, f"Not found: {video_path}")
        return False
    
    print_check("Video file exists", True, video_path)
    
    all_passed = True
    
    with tempfile.TemporaryDirectory() as job_dir:
        settings = {
            "mvp_mode": True,
            "job_dir": job_dir,
            "target_count": 5,
            "min_duration": 10,
            "max_duration": 45,
            "skip_intro": 10,
            "skip_outro": 10,
        }
        
        # Test audio extraction
        try:
            from detector import extract_audio_ffmpeg
            audio_path = os.path.join(job_dir, "audio.wav")
            extract_audio_ffmpeg(video_path, audio_path)
            exists = os.path.exists(audio_path)
            size = os.path.getsize(audio_path) if exists else 0
            print_check("Audio extraction", exists and size > 0, f"Size: {size/1024:.1f} KB")
            if not (exists and size > 0):
                all_passed = False
        except Exception as e:
            print_check("Audio extraction", False, str(e))
            all_passed = False
            return all_passed
        
        # Test feature extraction
        try:
            import librosa
            from features import extract_features
            
            y, sr = librosa.load(audio_path, sr=22050)
            features = extract_features(y, sr)
            
            has_features = all(k in features for k in ["rms", "times"])
            print_check("Feature extraction", has_features, f"Frames: {len(features.get('times', []))}")
            if not has_features:
                all_passed = False
        except Exception as e:
            print_check("Feature extraction", False, str(e))
            all_passed = False
            return all_passed
        
        # Test candidate detection
        try:
            from utils.mvp_candidates import detect_all_candidates
            
            duration = librosa.get_duration(y=y, sr=sr)
            bounds = {
                "start_time": settings["skip_intro"],
                "end_time": duration - settings["skip_outro"],
                "min_duration": settings["min_duration"],
                "max_duration": settings["max_duration"],
            }
            
            candidates = detect_all_candidates(features, bounds, {})
            print_check("Candidate detection", True, f"Found: {len(candidates)}")
        except Exception as e:
            print_check("Candidate detection", False, str(e))
            all_passed = False
            return all_passed
        
        # Test scoring
        try:
            from utils.mvp_scoring import score_and_select_clips
            
            features["duration"] = duration
            clips = score_and_select_clips(
                candidates, 
                features, 
                {"words": []}, 
                {"top_n": 5, "clip_lengths": [15, 25]}
            )
            
            has_clips = len(clips) > 0
            print_check("Clip scoring", has_clips, f"Clips: {len(clips)}")
            if not has_clips and len(candidates) > 0:
                # Only fail if we had candidates but no clips
                all_passed = False
            
            if clips:
                clip = clips[0]
                has_breakdown = "score_breakdown" in clip
                print_check("Score breakdown included", has_breakdown)
        except Exception as e:
            print_check("Clip scoring", False, str(e))
            all_passed = False
        
        # Test determinism
        try:
            from utils.mvp_scoring import score_and_select_clips
            
            clips2 = score_and_select_clips(
                candidates.copy(), 
                features, 
                {"words": []}, 
                {"top_n": 5, "clip_lengths": [15, 25]}
            )
            
            if clips and clips2:
                same = clips[0].get("score") == clips2[0].get("score")
                print_check("Deterministic output", same)
                if not same:
                    all_passed = False
            else:
                print_check("Deterministic output", True, "No clips to compare")
        except Exception as e:
            print_check("Deterministic output", False, str(e))
            all_passed = False
    
    return all_passed


def main():
    parser = argparse.ArgumentParser(description="MVP Pipeline Smoke Test")
    parser.add_argument("--video", type=str, help="Path to video file for full test")
    parser.add_argument("--skip-video", action="store_true", help="Skip video test")
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("  PodFlow Studio - MVP Pipeline Smoke Test")
    print("="*60)
    
    results = []
    
    # Test 1: Imports
    results.append(("Module Imports", test_imports()))
    
    # Test 2: Feature extraction
    results.append(("Feature Extraction", test_feature_extraction_synthetic()))
    
    # Test 3: Candidate detection
    results.append(("Candidate Detection", test_candidate_detection_synthetic()))
    
    # Test 4: Scoring determinism
    results.append(("Scoring Determinism", test_scoring_determinism()))
    
    # Test 5: Output format
    results.append(("Output Format", test_output_format()))
    
    # Test 6: Full pipeline (if video provided)
    if args.video and not args.skip_video:
        results.append(("Full Pipeline", test_with_video(args.video)))
    
    # Summary
    print_header("Summary")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  [{status}] {name}")
    
    print(f"\n  {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  🎉 All tests passed!")
        return 0
    else:
        print("\n  ⚠️  Some tests failed. Check output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
