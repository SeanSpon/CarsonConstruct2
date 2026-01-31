#!/usr/bin/env python3
"""
Speaker Diarization Module

Identifies who is speaking when in a podcast/video using:
1. pyannote.audio (preferred, most accurate)
2. Simple energy-based VAD fallback
3. Whisper speaker hints (if available)

Output is a list of speaker segments with timestamps.
"""

import os
import json
import tempfile
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, asdict


@dataclass
class SpeakerSegment:
    """A segment where a specific speaker is talking."""
    speaker_id: str
    speaker_label: str  # e.g., "SPEAKER_00" or user-assigned name
    start_time: float
    end_time: float
    confidence: float
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'duration': self.duration,
        }


@dataclass
class DiarizationResult:
    """Complete diarization result."""
    segments: List[SpeakerSegment]
    speaker_count: int
    total_duration: float
    speaker_stats: Dict[str, Dict[str, float]]  # speaker_id -> {total_time, percentage}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'segments': [s.to_dict() for s in self.segments],
            'speaker_count': self.speaker_count,
            'total_duration': self.total_duration,
            'speaker_stats': self.speaker_stats,
        }


def diarize_with_pyannote(
    audio_path: str,
    num_speakers: Optional[int] = None,
    min_speakers: int = 1,
    max_speakers: int = 10,
    huggingface_token: Optional[str] = None,
) -> DiarizationResult:
    """
    Perform speaker diarization using pyannote.audio.
    
    Args:
        audio_path: Path to audio file (WAV, MP3, etc.)
        num_speakers: Exact number of speakers (if known)
        min_speakers: Minimum expected speakers
        max_speakers: Maximum expected speakers
        huggingface_token: HuggingFace token for accessing pyannote models
        
    Returns:
        DiarizationResult with speaker segments
    """
    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError:
        raise ImportError(
            "pyannote.audio not installed. Install with: pip install pyannote.audio torch"
        )
    
    # Load pipeline (requires HuggingFace token for first download)
    token = huggingface_token or os.environ.get('HF_TOKEN')
    
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=token
    )
    
    # Use GPU if available
    if torch.cuda.is_available():
        pipeline.to(torch.device("cuda"))
    
    # Run diarization
    diarization_params = {}
    if num_speakers is not None:
        diarization_params['num_speakers'] = num_speakers
    else:
        diarization_params['min_speakers'] = min_speakers
        diarization_params['max_speakers'] = max_speakers
    
    diarization = pipeline(audio_path, **diarization_params)
    
    # Convert to our format
    segments = []
    speaker_times = {}
    
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segment = SpeakerSegment(
            speaker_id=speaker,
            speaker_label=speaker,
            start_time=turn.start,
            end_time=turn.end,
            confidence=0.9,  # pyannote doesn't expose confidence directly
        )
        segments.append(segment)
        
        # Track speaker time
        if speaker not in speaker_times:
            speaker_times[speaker] = 0.0
        speaker_times[speaker] += segment.duration
    
    # Calculate stats
    total_duration = segments[-1].end_time if segments else 0.0
    speaker_stats = {}
    for speaker_id, total_time in speaker_times.items():
        speaker_stats[speaker_id] = {
            'total_time': total_time,
            'percentage': (total_time / total_duration * 100) if total_duration > 0 else 0,
        }
    
    return DiarizationResult(
        segments=segments,
        speaker_count=len(speaker_times),
        total_duration=total_duration,
        speaker_stats=speaker_stats,
    )


def diarize_with_energy_vad(
    audio_path: str,
    min_speech_duration: float = 0.5,
    min_silence_duration: float = 0.3,
    energy_threshold: float = 0.02,
) -> DiarizationResult:
    """
    Simple energy-based VAD fallback (doesn't distinguish between speakers).
    
    This is used when pyannote is not available. It detects speech vs silence
    but treats all speech as coming from a single speaker.
    
    Args:
        audio_path: Path to audio file
        min_speech_duration: Minimum speech segment duration
        min_silence_duration: Minimum silence duration to split segments
        energy_threshold: RMS energy threshold for speech detection
        
    Returns:
        DiarizationResult with single speaker segments
    """
    try:
        import librosa
        import numpy as np
    except ImportError:
        raise ImportError("librosa not installed. Install with: pip install librosa numpy")
    
    # Load audio
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    duration = len(y) / sr
    
    # Calculate RMS energy in frames
    frame_length = int(0.025 * sr)  # 25ms frames
    hop_length = int(0.010 * sr)    # 10ms hop
    
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    
    # Normalize RMS
    rms_norm = rms / (np.max(rms) + 1e-10)
    
    # Find speech regions
    is_speech = rms_norm > energy_threshold
    
    # Smooth the speech detection
    from scipy.ndimage import binary_dilation, binary_erosion
    is_speech = binary_dilation(is_speech, iterations=3)
    is_speech = binary_erosion(is_speech, iterations=2)
    
    # Convert to segments
    segments = []
    in_speech = False
    speech_start = 0.0
    
    for i, (t, speech) in enumerate(zip(times, is_speech)):
        if speech and not in_speech:
            speech_start = t
            in_speech = True
        elif not speech and in_speech:
            if t - speech_start >= min_speech_duration:
                segments.append(SpeakerSegment(
                    speaker_id="SPEAKER_00",
                    speaker_label="Speaker",
                    start_time=speech_start,
                    end_time=t,
                    confidence=0.7,
                ))
            in_speech = False
    
    # Handle speech at end
    if in_speech and times[-1] - speech_start >= min_speech_duration:
        segments.append(SpeakerSegment(
            speaker_id="SPEAKER_00",
            speaker_label="Speaker",
            start_time=speech_start,
            end_time=times[-1],
            confidence=0.7,
        ))
    
    # Merge nearby segments
    merged_segments = []
    for segment in segments:
        if merged_segments and segment.start_time - merged_segments[-1].end_time < min_silence_duration:
            # Merge with previous
            merged_segments[-1] = SpeakerSegment(
                speaker_id=merged_segments[-1].speaker_id,
                speaker_label=merged_segments[-1].speaker_label,
                start_time=merged_segments[-1].start_time,
                end_time=segment.end_time,
                confidence=merged_segments[-1].confidence,
            )
        else:
            merged_segments.append(segment)
    
    total_speech_time = sum(s.duration for s in merged_segments)
    
    return DiarizationResult(
        segments=merged_segments,
        speaker_count=1,
        total_duration=duration,
        speaker_stats={
            "SPEAKER_00": {
                "total_time": total_speech_time,
                "percentage": (total_speech_time / duration * 100) if duration > 0 else 0,
            }
        },
    )


def diarize_with_whisper_hints(
    audio_path: str,
    transcript: Dict[str, Any],
) -> DiarizationResult:
    """
    Use Whisper transcript segment information for basic speaker separation.
    
    This is a very basic approach that uses pauses and segment boundaries
    to guess at speaker changes. Not as accurate as pyannote.
    
    Args:
        audio_path: Path to audio file
        transcript: Whisper transcript with segments
        
    Returns:
        DiarizationResult with estimated speaker segments
    """
    segments_data = transcript.get('segments', [])
    if not segments_data:
        return diarize_with_energy_vad(audio_path)
    
    # Simple heuristic: long pauses might indicate speaker change
    speaker_segments = []
    current_speaker = 0
    speaker_change_threshold = 2.0  # seconds of silence for potential speaker change
    
    for i, seg in enumerate(segments_data):
        start = seg.get('start', 0)
        end = seg.get('end', 0)
        
        # Check for speaker change based on pause
        if i > 0:
            prev_end = segments_data[i-1].get('end', 0)
            pause_duration = start - prev_end
            
            if pause_duration > speaker_change_threshold:
                current_speaker = (current_speaker + 1) % 2  # Toggle between 2 speakers
        
        speaker_segments.append(SpeakerSegment(
            speaker_id=f"SPEAKER_{current_speaker:02d}",
            speaker_label=f"Speaker {current_speaker + 1}",
            start_time=start,
            end_time=end,
            confidence=0.5,  # Low confidence for heuristic approach
        ))
    
    # Merge consecutive segments from same speaker
    merged = []
    for seg in speaker_segments:
        if merged and merged[-1].speaker_id == seg.speaker_id and seg.start_time - merged[-1].end_time < 0.5:
            merged[-1] = SpeakerSegment(
                speaker_id=merged[-1].speaker_id,
                speaker_label=merged[-1].speaker_label,
                start_time=merged[-1].start_time,
                end_time=seg.end_time,
                confidence=merged[-1].confidence,
            )
        else:
            merged.append(seg)
    
    # Calculate stats
    total_duration = merged[-1].end_time if merged else 0.0
    speaker_times = {}
    for seg in merged:
        if seg.speaker_id not in speaker_times:
            speaker_times[seg.speaker_id] = 0.0
        speaker_times[seg.speaker_id] += seg.duration
    
    speaker_stats = {}
    for speaker_id, total_time in speaker_times.items():
        speaker_stats[speaker_id] = {
            'total_time': total_time,
            'percentage': (total_time / total_duration * 100) if total_duration > 0 else 0,
        }
    
    return DiarizationResult(
        segments=merged,
        speaker_count=len(speaker_times),
        total_duration=total_duration,
        speaker_stats=speaker_stats,
    )


def run_speaker_diarization(
    audio_path: str,
    method: str = "auto",
    num_speakers: Optional[int] = None,
    huggingface_token: Optional[str] = None,
    transcript: Optional[Dict] = None,
) -> DiarizationResult:
    """
    Main entry point for speaker diarization.
    
    Args:
        audio_path: Path to audio file
        method: "pyannote", "vad", "whisper", or "auto"
        num_speakers: Number of speakers (if known)
        huggingface_token: HuggingFace token for pyannote
        transcript: Whisper transcript (for whisper method)
        
    Returns:
        DiarizationResult with speaker segments
    """
    if method == "auto":
        # Try methods in order of preference
        try:
            return diarize_with_pyannote(
                audio_path,
                num_speakers=num_speakers,
                huggingface_token=huggingface_token,
            )
        except (ImportError, Exception) as e:
            print(f"pyannote not available: {e}")
        
        if transcript:
            try:
                return diarize_with_whisper_hints(audio_path, transcript)
            except Exception as e:
                print(f"Whisper hints failed: {e}")
        
        return diarize_with_energy_vad(audio_path)
    
    elif method == "pyannote":
        return diarize_with_pyannote(
            audio_path,
            num_speakers=num_speakers,
            huggingface_token=huggingface_token,
        )
    
    elif method == "whisper":
        if not transcript:
            raise ValueError("Whisper method requires transcript")
        return diarize_with_whisper_hints(audio_path, transcript)
    
    elif method == "vad":
        return diarize_with_energy_vad(audio_path)
    
    else:
        raise ValueError(f"Unknown method: {method}")


def assign_speaker_names(
    result: DiarizationResult,
    speaker_mapping: Dict[str, str],
) -> DiarizationResult:
    """
    Assign user-provided names to speakers.
    
    Args:
        result: Diarization result
        speaker_mapping: Dict mapping speaker_id to name
        
    Returns:
        Updated DiarizationResult with named speakers
    """
    updated_segments = []
    for seg in result.segments:
        name = speaker_mapping.get(seg.speaker_id, seg.speaker_label)
        updated_segments.append(SpeakerSegment(
            speaker_id=seg.speaker_id,
            speaker_label=name,
            start_time=seg.start_time,
            end_time=seg.end_time,
            confidence=seg.confidence,
        ))
    
    updated_stats = {}
    for speaker_id, stats in result.speaker_stats.items():
        name = speaker_mapping.get(speaker_id, speaker_id)
        updated_stats[speaker_id] = {
            **stats,
            'name': name,
        }
    
    return DiarizationResult(
        segments=updated_segments,
        speaker_count=result.speaker_count,
        total_duration=result.total_duration,
        speaker_stats=updated_stats,
    )


# CLI for testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python speaker_diarization.py <audio_path> [method] [num_speakers]")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    method = sys.argv[2] if len(sys.argv) > 2 else "auto"
    num_speakers = int(sys.argv[3]) if len(sys.argv) > 3 else None
    
    print(f"Running speaker diarization on {audio_path} with method={method}")
    
    result = run_speaker_diarization(
        audio_path,
        method=method,
        num_speakers=num_speakers,
    )
    
    print(f"\nFound {result.speaker_count} speakers")
    print(f"Total duration: {result.total_duration:.2f}s")
    
    print("\nSpeaker stats:")
    for speaker_id, stats in result.speaker_stats.items():
        print(f"  {speaker_id}: {stats['total_time']:.2f}s ({stats['percentage']:.1f}%)")
    
    print(f"\nTotal segments: {len(result.segments)}")
    print("\nFirst 10 segments:")
    for seg in result.segments[:10]:
        print(f"  [{seg.start_time:.2f} - {seg.end_time:.2f}] {seg.speaker_label}")
