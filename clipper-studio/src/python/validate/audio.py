"""
Audio validation for Clipper Studio.

Checks:
- RMS > silence threshold (audio not silent)
- No sudden dropouts (audio continuity)
- Sample rate consistent

These are MECHANICAL checks, not content quality judgments.
"""

import os
from typing import Dict, Optional, Tuple
import numpy as np

from .result import ValidationResult, ErrorSeverity


class AudioValidator:
    """Validates audio data for clips."""
    
    def __init__(
        self,
        silence_threshold_db: float = -40.0,  # dB below which is silence
        dropout_threshold_db: float = -50.0,  # dB for sudden dropout
        max_dropout_duration: float = 0.5,     # seconds
        expected_sample_rate: int = 22050,
    ):
        self.silence_threshold_db = silence_threshold_db
        self.dropout_threshold_db = dropout_threshold_db
        self.max_dropout_duration = max_dropout_duration
        self.expected_sample_rate = expected_sample_rate
        
        # Convert dB to linear amplitude
        self.silence_threshold = 10 ** (silence_threshold_db / 20)
        self.dropout_threshold = 10 ** (dropout_threshold_db / 20)
    
    def validate(
        self,
        audio_path: Optional[str] = None,
        audio_data: Optional[Tuple[np.ndarray, int]] = None,
        clip_start: Optional[float] = None,
        clip_end: Optional[float] = None,
    ) -> ValidationResult:
        """
        Validate audio for a clip.
        
        Args:
            audio_path: Path to audio file (WAV)
            audio_data: Tuple of (samples, sample_rate) if already loaded
            clip_start: Start time of clip in seconds
            clip_end: End time of clip in seconds
        
        Returns:
            ValidationResult with any errors found
        """
        result = ValidationResult(
            valid=True,
            validator_name='AudioValidator',
        )
        
        # Load audio if needed
        if audio_data is not None:
            y, sr = audio_data
        elif audio_path is not None:
            y, sr = self._load_audio(audio_path, result)
            if y is None:
                return result
        else:
            result.add_error(
                code="AUDIO_NO_INPUT",
                message="No audio path or data provided",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return result
        
        # Extract clip segment if bounds provided
        if clip_start is not None and clip_end is not None:
            start_sample = int(clip_start * sr)
            end_sample = int(clip_end * sr)
            y = y[start_sample:end_sample]
        
        if len(y) == 0:
            result.add_error(
                code="AUDIO_EMPTY",
                message="Audio segment is empty",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return result
        
        # Check sample rate
        self._check_sample_rate(result, sr)
        
        # Check overall RMS (not silent)
        self._check_silence(result, y)
        
        # Check for dropouts
        self._check_dropouts(result, y, sr)
        
        return result
    
    def _load_audio(
        self,
        audio_path: str,
        result: ValidationResult,
    ) -> Tuple[Optional[np.ndarray], Optional[int]]:
        """Load audio file."""
        if not os.path.exists(audio_path):
            result.add_error(
                code="AUDIO_FILE_NOT_FOUND",
                message=f"Audio file not found: {audio_path}",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None, None
        
        try:
            import librosa
            y, sr = librosa.load(audio_path, sr=None)
            return y, sr
        except Exception as e:
            result.add_error(
                code="AUDIO_LOAD_FAILED",
                message=f"Failed to load audio: {e}",
                severity=ErrorSeverity.HARD_FAILURE,
            )
            return None, None
    
    def _check_sample_rate(self, result: ValidationResult, sr: int):
        """Check if sample rate matches expected."""
        if sr != self.expected_sample_rate:
            result.add_error(
                code="AUDIO_SAMPLE_RATE_MISMATCH",
                message=f"Sample rate {sr}Hz does not match expected {self.expected_sample_rate}Hz",
                severity=ErrorSeverity.WARNING,
                field="sample_rate",
                actual=sr,
                expected=self.expected_sample_rate,
            )
    
    def _check_silence(self, result: ValidationResult, y: np.ndarray):
        """Check if audio is too quiet (silent)."""
        rms = np.sqrt(np.mean(y ** 2))
        
        if rms < self.silence_threshold:
            rms_db = 20 * np.log10(max(rms, 1e-10))
            result.add_error(
                code="AUDIO_TOO_QUIET",
                message=f"Audio RMS {rms_db:.1f}dB is below threshold {self.silence_threshold_db}dB",
                severity=ErrorSeverity.ERROR,
                field="rms",
                rms_db=rms_db,
                threshold_db=self.silence_threshold_db,
            )
    
    def _check_dropouts(self, result: ValidationResult, y: np.ndarray, sr: int):
        """Check for sudden audio dropouts."""
        # Calculate RMS in short windows
        window_size = int(0.05 * sr)  # 50ms windows
        hop_size = int(0.025 * sr)    # 25ms hop
        
        if window_size < 1:
            return
        
        dropout_start = None
        dropout_samples = 0
        
        for i in range(0, len(y) - window_size, hop_size):
            window = y[i:i + window_size]
            rms = np.sqrt(np.mean(window ** 2))
            
            if rms < self.dropout_threshold:
                if dropout_start is None:
                    dropout_start = i
                dropout_samples = i + window_size - dropout_start
            else:
                if dropout_start is not None:
                    # Check if dropout was too long
                    dropout_duration = dropout_samples / sr
                    if dropout_duration > self.max_dropout_duration:
                        dropout_time = dropout_start / sr
                        result.add_error(
                            code="AUDIO_DROPOUT",
                            message=f"Audio dropout of {dropout_duration:.2f}s at {dropout_time:.2f}s",
                            severity=ErrorSeverity.ERROR,
                            field="audio",
                            dropout_start=dropout_time,
                            dropout_duration=dropout_duration,
                        )
                    dropout_start = None
                    dropout_samples = 0
        
        # Check final dropout
        if dropout_start is not None:
            dropout_duration = dropout_samples / sr
            if dropout_duration > self.max_dropout_duration:
                dropout_time = dropout_start / sr
                result.add_error(
                    code="AUDIO_DROPOUT",
                    message=f"Audio dropout of {dropout_duration:.2f}s at {dropout_time:.2f}s (end)",
                    severity=ErrorSeverity.ERROR,
                    field="audio",
                    dropout_start=dropout_time,
                    dropout_duration=dropout_duration,
                )


def check_audio_levels(
    y: np.ndarray,
    sr: int,
    target_lufs: float = -16.0,
    tolerance_db: float = 3.0,
) -> ValidationResult:
    """
    Check if audio levels are within target range.
    
    This is an optional loudness check, not required for basic validation.
    
    Args:
        y: Audio samples
        sr: Sample rate
        target_lufs: Target loudness in LUFS
        tolerance_db: Acceptable deviation from target
    
    Returns:
        ValidationResult with level warnings
    """
    result = ValidationResult(
        valid=True,
        validator_name='AudioLevelCheck',
    )
    
    # Simple RMS-based approximation of loudness
    # (true LUFS requires ITU-R BS.1770 K-weighting)
    rms = np.sqrt(np.mean(y ** 2))
    rms_db = 20 * np.log10(max(rms, 1e-10))
    
    # Rough LUFS approximation (RMS dBFS ≈ LUFS for speech)
    estimated_lufs = rms_db - 3  # Approximate adjustment
    
    deviation = abs(estimated_lufs - target_lufs)
    if deviation > tolerance_db:
        result.add_error(
            code="AUDIO_LEVEL_OUT_OF_RANGE",
            message=f"Audio level ~{estimated_lufs:.1f} LUFS deviates from target {target_lufs} LUFS",
            severity=ErrorSeverity.WARNING,
            estimated_lufs=estimated_lufs,
            target_lufs=target_lufs,
            deviation_db=deviation,
        )
    
    return result
