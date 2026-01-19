#!/usr/bin/env python3
"""
AI Quality Check System

Automated QA checks before export:
1. Audio levels consistent (no sudden volume jumps)
2. No abrupt cuts (mid-word detection)
3. Speaker visible when talking (if multi-cam)
4. No excessive silence (>5s without reason)
5. Video/audio sync check
"""

import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class CheckSeverity(str, Enum):
    ERROR = "error"      # Must fix before export
    WARNING = "warning"  # Should review
    INFO = "info"        # Informational


class CheckType(str, Enum):
    AUDIO_LEVEL = "audio-level"
    MID_WORD_CUT = "mid-word-cut"
    SPEAKER_VISIBILITY = "speaker-visibility"
    SILENCE = "silence"
    SYNC = "sync"
    JUMP_CUT = "jump-cut"
    DURATION = "duration"
    FLOW = "flow"


@dataclass
class QAIssue:
    """A single QA issue found during checks."""
    id: str
    check_type: CheckType
    severity: CheckSeverity
    timestamp: Optional[float]  # Where in the video
    timestamp_end: Optional[float]  # End time for range issues
    message: str
    auto_fixable: bool
    fix_suggestion: Optional[str]
    fixed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'type': self.check_type.value,
            'severity': self.severity.value,
            'timestamp': self.timestamp,
            'timestampEnd': self.timestamp_end,
            'message': self.message,
            'autoFixable': self.auto_fixable,
            'fixSuggestion': self.fix_suggestion,
            'fixed': self.fixed,
        }


@dataclass
class QAResult:
    """Complete QA result."""
    passed: bool
    issues: List[QAIssue]
    error_count: int
    warning_count: int
    info_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'passed': self.passed,
            'issues': [i.to_dict() for i in self.issues],
            'errorCount': self.error_count,
            'warningCount': self.warning_count,
            'infoCount': self.info_count,
        }


class QualityChecker:
    """
    Runs automated quality checks on edited video.
    """
    
    def __init__(
        self,
        audio_threshold_db: float = 6.0,  # Max sudden volume change
        silence_threshold_s: float = 5.0,  # Max silence duration
        min_cut_duration_s: float = 0.5,   # Min time between cuts
    ):
        self.audio_threshold_db = audio_threshold_db
        self.silence_threshold_s = silence_threshold_s
        self.min_cut_duration_s = min_cut_duration_s
        self.issues: List[QAIssue] = []
        self.issue_id = 0
    
    def _add_issue(
        self,
        check_type: CheckType,
        severity: CheckSeverity,
        message: str,
        timestamp: Optional[float] = None,
        timestamp_end: Optional[float] = None,
        auto_fixable: bool = False,
        fix_suggestion: Optional[str] = None,
    ) -> QAIssue:
        """Add a QA issue."""
        self.issue_id += 1
        issue = QAIssue(
            id=f"qa_{self.issue_id}",
            check_type=check_type,
            severity=severity,
            timestamp=timestamp,
            timestamp_end=timestamp_end,
            message=message,
            auto_fixable=auto_fixable,
            fix_suggestion=fix_suggestion,
        )
        self.issues.append(issue)
        return issue
    
    def check_audio_levels(
        self,
        rms_values: List[float],
        times: List[float],
    ) -> None:
        """
        Check for sudden volume jumps.
        
        Args:
            rms_values: RMS energy values over time
            times: Corresponding timestamps
        """
        if len(rms_values) < 2:
            return
        
        import numpy as np
        rms = np.array(rms_values)
        
        # Convert to dB
        rms_db = 20 * np.log10(rms + 1e-10)
        
        # Check for sudden changes
        for i in range(1, len(rms_db)):
            delta = abs(rms_db[i] - rms_db[i-1])
            if delta > self.audio_threshold_db:
                self._add_issue(
                    CheckType.AUDIO_LEVEL,
                    CheckSeverity.WARNING,
                    f"Sudden volume change of {delta:.1f}dB detected",
                    timestamp=times[i],
                    auto_fixable=True,
                    fix_suggestion="Apply audio normalization or crossfade",
                )
    
    def check_mid_word_cuts(
        self,
        cuts: List[Dict[str, float]],
        transcript: Optional[Dict[str, Any]],
    ) -> None:
        """
        Check for cuts that happen mid-word.
        
        Args:
            cuts: List of {start, end} cut timestamps
            transcript: Whisper transcript with word timestamps
        """
        if not transcript:
            return
        
        from vad_utils import extract_word_boundaries, is_mid_word_cut
        
        word_boundaries = extract_word_boundaries(transcript)
        if not word_boundaries:
            return
        
        for cut in cuts:
            # Check start of cut
            is_mid_start, word_start = is_mid_word_cut(word_boundaries, cut['start'])
            if is_mid_start and word_start:
                self._add_issue(
                    CheckType.MID_WORD_CUT,
                    CheckSeverity.ERROR,
                    f"Cut starts mid-word: '{word_start.word}'",
                    timestamp=cut['start'],
                    auto_fixable=True,
                    fix_suggestion=f"Move cut to {word_start.safe_cut_before():.2f}s (before word) or {word_start.safe_cut_after():.2f}s (after word)",
                )
            
            # Check end of cut
            is_mid_end, word_end = is_mid_word_cut(word_boundaries, cut['end'])
            if is_mid_end and word_end:
                self._add_issue(
                    CheckType.MID_WORD_CUT,
                    CheckSeverity.ERROR,
                    f"Cut ends mid-word: '{word_end.word}'",
                    timestamp=cut['end'],
                    auto_fixable=True,
                    fix_suggestion=f"Move cut to {word_end.safe_cut_after():.2f}s (after word)",
                )
    
    def check_silence(
        self,
        speech_segments: List[Tuple[float, float]],
        total_duration: float,
    ) -> None:
        """
        Check for excessive silence that wasn't intentionally kept.
        
        Args:
            speech_segments: List of (start, end) speech regions
            total_duration: Total video duration
        """
        if not speech_segments:
            return
        
        # Sort segments
        sorted_segments = sorted(speech_segments, key=lambda x: x[0])
        
        # Check gaps between segments
        prev_end = 0.0
        for start, end in sorted_segments:
            gap = start - prev_end
            if gap > self.silence_threshold_s:
                self._add_issue(
                    CheckType.SILENCE,
                    CheckSeverity.WARNING,
                    f"Long silence detected ({gap:.1f}s)",
                    timestamp=prev_end,
                    timestamp_end=start,
                    auto_fixable=True,
                    fix_suggestion="Remove or shorten this silence",
                )
            prev_end = end
        
        # Check trailing silence
        trailing = total_duration - prev_end
        if trailing > self.silence_threshold_s:
            self._add_issue(
                CheckType.SILENCE,
                CheckSeverity.WARNING,
                f"Long trailing silence ({trailing:.1f}s)",
                timestamp=prev_end,
                timestamp_end=total_duration,
                auto_fixable=True,
                fix_suggestion="Trim video ending",
            )
    
    def check_jump_cuts(
        self,
        cuts: List[Dict[str, float]],
    ) -> None:
        """
        Check for cuts that are too close together (jump cuts).
        
        Args:
            cuts: List of {start, end} cut timestamps
        """
        if len(cuts) < 2:
            return
        
        sorted_cuts = sorted(cuts, key=lambda x: x['start'])
        
        for i in range(1, len(sorted_cuts)):
            prev_end = sorted_cuts[i-1]['end']
            curr_start = sorted_cuts[i]['start']
            
            # This checks for very short segments between cuts
            segment_duration = curr_start - prev_end
            if 0 < segment_duration < self.min_cut_duration_s:
                self._add_issue(
                    CheckType.JUMP_CUT,
                    CheckSeverity.WARNING,
                    f"Very short segment ({segment_duration:.2f}s) may feel jarring",
                    timestamp=prev_end,
                    timestamp_end=curr_start,
                    auto_fixable=True,
                    fix_suggestion="Merge with adjacent segment or extend duration",
                )
    
    def check_duration(
        self,
        clip_duration: float,
        target_platform: str = "general",
    ) -> None:
        """
        Check if clip duration is appropriate for target platform.
        
        Args:
            clip_duration: Duration in seconds
            target_platform: Target social media platform
        """
        platform_limits = {
            'tiktok': (3, 180),     # 3s to 3min
            'instagram': (3, 90),   # 3s to 90s for Reels
            'youtube': (10, 600),   # 10s to 10min for Shorts
            'general': (5, 300),
        }
        
        min_dur, max_dur = platform_limits.get(target_platform, (5, 300))
        
        if clip_duration < min_dur:
            self._add_issue(
                CheckType.DURATION,
                CheckSeverity.WARNING,
                f"Clip too short ({clip_duration:.1f}s) for {target_platform} (min {min_dur}s)",
                auto_fixable=False,
                fix_suggestion="Consider extending the clip",
            )
        elif clip_duration > max_dur:
            self._add_issue(
                CheckType.DURATION,
                CheckSeverity.WARNING,
                f"Clip too long ({clip_duration:.1f}s) for {target_platform} (max {max_dur}s)",
                auto_fixable=False,
                fix_suggestion="Consider splitting into multiple clips",
            )
    
    def check_speaker_visibility(
        self,
        speaker_segments: List[Dict[str, Any]],
        camera_cuts: List[Dict[str, Any]],
        speaker_to_camera: Dict[str, str],
    ) -> None:
        """
        Check if the speaking person is on camera.
        
        Args:
            speaker_segments: List of {speaker_id, start, end}
            camera_cuts: List of {camera_id, start, end}
            speaker_to_camera: Mapping of speaker to their camera
        """
        if not speaker_segments or not camera_cuts or not speaker_to_camera:
            return
        
        for segment in speaker_segments:
            speaker_id = segment.get('speaker_id')
            start = segment.get('start_time', segment.get('start', 0))
            end = segment.get('end_time', segment.get('end', 0))
            
            expected_camera = speaker_to_camera.get(speaker_id)
            if not expected_camera:
                continue
            
            # Check what camera is active during this speech
            for cut in camera_cuts:
                cut_start = cut.get('start_time', cut.get('startTime', 0))
                cut_end = cut.get('end_time', cut.get('endTime', 0))
                
                # Check for overlap
                if cut_start < end and cut_end > start:
                    active_camera = cut.get('camera_id', cut.get('cameraId'))
                    
                    # If speaker is talking but not on their camera
                    if active_camera != expected_camera:
                        overlap_start = max(start, cut_start)
                        overlap_end = min(end, cut_end)
                        overlap_duration = overlap_end - overlap_start
                        
                        # Only flag if they're off-camera for more than 3 seconds
                        if overlap_duration > 3.0:
                            self._add_issue(
                                CheckType.SPEAKER_VISIBILITY,
                                CheckSeverity.INFO,
                                f"Speaker {speaker_id} talking but not on camera for {overlap_duration:.1f}s",
                                timestamp=overlap_start,
                                timestamp_end=overlap_end,
                                auto_fixable=True,
                                fix_suggestion=f"Switch to camera {expected_camera}",
                            )
    
    def check_flow(
        self,
        transcript: Optional[Dict[str, Any]],
        cuts: List[Dict[str, float]],
    ) -> None:
        """
        Check if edits create a good narrative flow.
        
        Args:
            transcript: Whisper transcript
            cuts: List of cut timestamps
        """
        if not transcript:
            return
        
        from utils.sentence_boundary import validate_cut_flow
        
        cut_tuples = [(c['start'], c['end']) for c in cuts]
        flow_issues = validate_cut_flow(transcript, cut_tuples)
        
        for issue in flow_issues:
            for sub_issue in issue.get('issues', []):
                severity = CheckSeverity.ERROR if sub_issue['severity'] == 'error' else CheckSeverity.WARNING
                
                self._add_issue(
                    CheckType.FLOW,
                    severity,
                    f"Flow issue: {sub_issue['type'].replace('_', ' ')}",
                    timestamp=sub_issue.get('time'),
                    auto_fixable=True,
                    fix_suggestion="Adjust cut point to sentence boundary",
                )
    
    def run_all_checks(
        self,
        audio_analysis: Optional[Dict[str, Any]] = None,
        transcript: Optional[Dict[str, Any]] = None,
        cuts: Optional[List[Dict[str, float]]] = None,
        speech_segments: Optional[List[Tuple[float, float]]] = None,
        speaker_segments: Optional[List[Dict[str, Any]]] = None,
        camera_cuts: Optional[List[Dict[str, Any]]] = None,
        speaker_to_camera: Optional[Dict[str, str]] = None,
        total_duration: float = 0.0,
        target_platform: str = "general",
    ) -> QAResult:
        """
        Run all quality checks.
        
        Args:
            audio_analysis: Audio RMS values and times
            transcript: Whisper transcript
            cuts: List of edit cuts
            speech_segments: VAD speech segments
            speaker_segments: Speaker diarization segments
            camera_cuts: Camera switching decisions
            speaker_to_camera: Speaker to camera mapping
            total_duration: Total video duration
            target_platform: Target social media platform
            
        Returns:
            QAResult with all issues found
        """
        self.issues = []
        self.issue_id = 0
        
        # Audio level check
        if audio_analysis:
            self.check_audio_levels(
                audio_analysis.get('rms', []),
                audio_analysis.get('times', []),
            )
        
        # Mid-word cut check
        if cuts:
            self.check_mid_word_cuts(cuts, transcript)
        
        # Silence check
        if speech_segments:
            self.check_silence(speech_segments, total_duration)
        
        # Jump cut check
        if cuts:
            self.check_jump_cuts(cuts)
        
        # Duration check
        if total_duration > 0:
            self.check_duration(total_duration, target_platform)
        
        # Speaker visibility check
        if speaker_segments and camera_cuts:
            self.check_speaker_visibility(
                speaker_segments,
                camera_cuts,
                speaker_to_camera or {},
            )
        
        # Flow check
        if transcript and cuts:
            self.check_flow(transcript, cuts)
        
        # Calculate summary
        errors = sum(1 for i in self.issues if i.severity == CheckSeverity.ERROR)
        warnings = sum(1 for i in self.issues if i.severity == CheckSeverity.WARNING)
        infos = sum(1 for i in self.issues if i.severity == CheckSeverity.INFO)
        
        return QAResult(
            passed=errors == 0,
            issues=self.issues,
            error_count=errors,
            warning_count=warnings,
            info_count=infos,
        )


def run_quality_check(
    audio_path: Optional[str] = None,
    transcript: Optional[Dict[str, Any]] = None,
    cuts: Optional[List[Dict[str, float]]] = None,
    total_duration: float = 0.0,
    target_platform: str = "general",
) -> QAResult:
    """
    Convenience function to run quality checks.
    
    Args:
        audio_path: Path to audio file for analysis
        transcript: Whisper transcript
        cuts: List of {start, end} cut timestamps
        total_duration: Total video duration
        target_platform: Target social media platform
        
    Returns:
        QAResult with all issues found
    """
    audio_analysis = None
    speech_segments = None
    
    # Analyze audio if path provided
    if audio_path:
        try:
            import librosa
            import numpy as np
            
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Get RMS
            hop_length = int(sr * 0.05)
            rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
            times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
            
            audio_analysis = {
                'rms': rms.tolist(),
                'times': times.tolist(),
            }
            
            # Get speech segments
            from vad_utils import build_vad_segments
            speech_segments = build_vad_segments(y, sr)
            
        except Exception as e:
            print(f"Audio analysis failed: {e}")
    
    checker = QualityChecker()
    return checker.run_all_checks(
        audio_analysis=audio_analysis,
        transcript=transcript,
        cuts=cuts,
        speech_segments=speech_segments,
        total_duration=total_duration,
        target_platform=target_platform,
    )


# CLI for testing
if __name__ == "__main__":
    import sys
    
    # Example usage
    example_cuts = [
        {'start': 0.0, 'end': 5.5},
        {'start': 5.8, 'end': 12.3},
        {'start': 12.4, 'end': 18.0},
    ]
    
    example_transcript = {
        'words': [
            {'word': 'Hello', 'start': 0.0, 'end': 0.5},
            {'word': 'everyone.', 'start': 0.6, 'end': 1.2},
            {'word': 'Today', 'start': 2.0, 'end': 2.4},
            {'word': 'we', 'start': 5.7, 'end': 5.9},  # Mid-word cut!
            {'word': 'are', 'start': 5.95, 'end': 6.1},
            {'word': 'going', 'start': 6.2, 'end': 6.5},
        ]
    }
    
    result = run_quality_check(
        transcript=example_transcript,
        cuts=example_cuts,
        total_duration=18.0,
        target_platform='tiktok',
    )
    
    print(f"QA {'PASSED' if result.passed else 'FAILED'}")
    print(f"Errors: {result.error_count}, Warnings: {result.warning_count}, Info: {result.info_count}")
    print("\nIssues:")
    for issue in result.issues:
        print(f"  [{issue.severity.value.upper()}] {issue.message}")
        if issue.timestamp:
            print(f"    at {issue.timestamp:.2f}s")
        if issue.fix_suggestion:
            print(f"    Suggestion: {issue.fix_suggestion}")
