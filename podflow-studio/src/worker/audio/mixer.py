#!/usr/bin/env python3
"""
Audio Mixing Engine

Handles audio mixing with proper volume levels:
- Main dialogue: 100% (0dB) 
- B-roll audio: -12dB (background ambience)
- Sound effects: -6dB (audible but not dominant)
- Music/underscore: -18dB (subtle)

Also supports:
- Audio ducking (lower music when speech present)
- Crossfades between clips
- Normalization
"""

import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class TrackType(str, Enum):
    """Audio track types with default volume levels."""
    MAIN = "main"          # 0dB - Primary dialogue
    BROLL = "broll"        # -12dB - B-roll ambience
    SFX = "sfx"            # -6dB - Sound effects
    MUSIC = "music"        # -18dB - Background music
    VOICEOVER = "voiceover"  # -3dB - Additional narration


# Default volume levels in dB
DEFAULT_VOLUMES: Dict[TrackType, float] = {
    TrackType.MAIN: 0.0,
    TrackType.BROLL: -12.0,
    TrackType.SFX: -6.0,
    TrackType.MUSIC: -18.0,
    TrackType.VOICEOVER: -3.0,
}


@dataclass
class AudioTrack:
    """Represents an audio track in the mix."""
    id: str
    track_type: TrackType
    file_path: Optional[str] = None  # None for main video audio
    start_time: float = 0.0  # When track starts in output
    end_time: float = 0.0    # When track ends in output
    source_start: float = 0.0  # Start position in source file
    volume_db: Optional[float] = None  # Override default volume
    fade_in: float = 0.0     # Fade in duration
    fade_out: float = 0.0    # Fade out duration
    duck_under_speech: bool = True  # Whether to duck under dialogue
    duck_amount_db: float = -10.0  # How much to duck
    
    @property
    def volume(self) -> float:
        """Get volume in dB."""
        if self.volume_db is not None:
            return self.volume_db
        return DEFAULT_VOLUMES.get(self.track_type, 0.0)
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'track_type': self.track_type.value,
            'file_path': self.file_path,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'source_start': self.source_start,
            'volume_db': self.volume,
            'fade_in': self.fade_in,
            'fade_out': self.fade_out,
            'duck_under_speech': self.duck_under_speech,
            'duck_amount_db': self.duck_amount_db,
        }


@dataclass
class AudioMixConfig:
    """Configuration for the audio mix."""
    normalize_output: bool = True
    target_loudness_lufs: float = -16.0  # Broadcast standard
    max_peak_db: float = -1.0  # True peak limit
    crossfade_duration: float = 0.1  # Default crossfade between clips
    ducking_enabled: bool = True
    ducking_attack_ms: float = 50.0  # How fast to duck
    ducking_release_ms: float = 200.0  # How fast to un-duck
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'normalize_output': self.normalize_output,
            'target_loudness_lufs': self.target_loudness_lufs,
            'max_peak_db': self.max_peak_db,
            'crossfade_duration': self.crossfade_duration,
            'ducking_enabled': self.ducking_enabled,
            'ducking_attack_ms': self.ducking_attack_ms,
            'ducking_release_ms': self.ducking_release_ms,
        }


class AudioMixer:
    """
    Generates FFmpeg filter chains for mixing multiple audio tracks.
    """
    
    def __init__(self, config: Optional[AudioMixConfig] = None):
        self.config = config or AudioMixConfig()
        self.tracks: List[AudioTrack] = []
        self.main_track: Optional[AudioTrack] = None
    
    def add_track(self, track: AudioTrack) -> None:
        """Add an audio track to the mix."""
        if track.track_type == TrackType.MAIN:
            self.main_track = track
        self.tracks.append(track)
    
    def add_main_audio(
        self,
        start_time: float = 0.0,
        end_time: float = 0.0,
        volume_db: float = 0.0,
    ) -> AudioTrack:
        """Add the main video's audio track."""
        track = AudioTrack(
            id="main_audio",
            track_type=TrackType.MAIN,
            start_time=start_time,
            end_time=end_time,
            volume_db=volume_db,
            duck_under_speech=False,
        )
        self.add_track(track)
        return track
    
    def add_broll_audio(
        self,
        file_path: str,
        start_time: float,
        end_time: float,
        source_start: float = 0.0,
        volume_db: float = -12.0,
        fade_in: float = 0.5,
        fade_out: float = 0.5,
    ) -> AudioTrack:
        """Add B-roll audio (background ambience)."""
        track = AudioTrack(
            id=f"broll_{len(self.tracks)}",
            track_type=TrackType.BROLL,
            file_path=file_path,
            start_time=start_time,
            end_time=end_time,
            source_start=source_start,
            volume_db=volume_db,
            fade_in=fade_in,
            fade_out=fade_out,
            duck_under_speech=True,
        )
        self.add_track(track)
        return track
    
    def add_sfx(
        self,
        file_path: str,
        start_time: float,
        volume_db: float = -6.0,
        fade_out: float = 0.0,
    ) -> AudioTrack:
        """Add a sound effect."""
        track = AudioTrack(
            id=f"sfx_{len(self.tracks)}",
            track_type=TrackType.SFX,
            file_path=file_path,
            start_time=start_time,
            end_time=start_time + 10.0,  # Will be trimmed to actual length
            volume_db=volume_db,
            fade_out=fade_out,
            duck_under_speech=False,
        )
        self.add_track(track)
        return track
    
    def add_music(
        self,
        file_path: str,
        start_time: float,
        end_time: float,
        source_start: float = 0.0,
        volume_db: float = -18.0,
        fade_in: float = 2.0,
        fade_out: float = 2.0,
    ) -> AudioTrack:
        """Add background music."""
        track = AudioTrack(
            id=f"music_{len(self.tracks)}",
            track_type=TrackType.MUSIC,
            file_path=file_path,
            start_time=start_time,
            end_time=end_time,
            source_start=source_start,
            volume_db=volume_db,
            fade_in=fade_in,
            fade_out=fade_out,
            duck_under_speech=True,
            duck_amount_db=-10.0,
        )
        self.add_track(track)
        return track
    
    def generate_filter_complex(
        self,
        input_count: int = 1,
        main_audio_input: int = 0,
    ) -> Tuple[str, List[str]]:
        """
        Generate FFmpeg filter_complex string for mixing.
        
        Args:
            input_count: Number of input files
            main_audio_input: Which input has the main audio (usually 0)
            
        Returns:
            Tuple of (filter_complex_string, additional_input_files)
        """
        filters = []
        mix_inputs = []
        additional_inputs = []
        input_index = input_count
        
        # Process main audio first
        main_filters = []
        if self.main_track:
            track = self.main_track
            label = "main"
            
            # Volume adjustment
            volume = track.volume
            if volume != 0:
                main_filters.append(f"volume={self._db_to_ratio(volume)}")
            
            # Fade in/out
            if track.fade_in > 0:
                main_filters.append(f"afade=t=in:st={track.start_time}:d={track.fade_in}")
            if track.fade_out > 0:
                main_filters.append(f"afade=t=out:st={track.end_time - track.fade_out}:d={track.fade_out}")
            
            if main_filters:
                filters.append(f"[{main_audio_input}:a]{','.join(main_filters)}[{label}]")
            else:
                filters.append(f"[{main_audio_input}:a]acopy[{label}]")
            
            mix_inputs.append(f"[{label}]")
        
        # Process other tracks
        for track in self.tracks:
            if track.track_type == TrackType.MAIN:
                continue
            
            if track.file_path:
                additional_inputs.append(track.file_path)
                audio_input = f"{input_index}:a"
                input_index += 1
            else:
                continue
            
            label = track.id
            track_filters = []
            
            # Trim to segment
            if track.source_start > 0 or track.duration > 0:
                start = track.source_start
                end = track.source_start + track.duration
                track_filters.append(f"atrim=start={start}:end={end}")
                track_filters.append("asetpts=PTS-STARTPTS")
            
            # Delay to start position
            if track.start_time > 0:
                delay_ms = int(track.start_time * 1000)
                track_filters.append(f"adelay={delay_ms}|{delay_ms}")
            
            # Volume
            volume = track.volume
            if volume != 0:
                track_filters.append(f"volume={self._db_to_ratio(volume)}")
            
            # Fades
            if track.fade_in > 0:
                track_filters.append(f"afade=t=in:st=0:d={track.fade_in}")
            if track.fade_out > 0:
                fade_start = track.duration - track.fade_out
                track_filters.append(f"afade=t=out:st={fade_start}:d={track.fade_out}")
            
            if track_filters:
                filters.append(f"[{audio_input}]{','.join(track_filters)}[{label}]")
            else:
                filters.append(f"[{audio_input}]acopy[{label}]")
            
            mix_inputs.append(f"[{label}]")
        
        # Mix all tracks together
        if len(mix_inputs) > 1:
            mix_filter = f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:duration=longest"
            
            # Add normalization if enabled
            if self.config.normalize_output:
                mix_filter += f"[mixed];[mixed]loudnorm=I={self.config.target_loudness_lufs}:TP={self.config.max_peak_db}"
            
            mix_filter += "[aout]"
            filters.append(mix_filter)
        elif mix_inputs:
            # Single track - just normalize if needed
            label = mix_inputs[0].strip('[]')
            if self.config.normalize_output:
                filters.append(
                    f"[{label}]loudnorm=I={self.config.target_loudness_lufs}:TP={self.config.max_peak_db}[aout]"
                )
            else:
                filters.append(f"[{label}]acopy[aout]")
        
        filter_complex = ";".join(filters)
        return filter_complex, additional_inputs
    
    def _db_to_ratio(self, db: float) -> float:
        """Convert dB to linear ratio."""
        return 10 ** (db / 20)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'config': self.config.to_dict(),
            'tracks': [t.to_dict() for t in self.tracks],
        }


def generate_ffmpeg_audio_filter(
    tracks: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
    main_audio_input: int = 0,
) -> Tuple[str, List[str]]:
    """
    Convenience function to generate FFmpeg audio filter from track dicts.
    
    Args:
        tracks: List of track dictionaries
        config: Optional AudioMixConfig dict
        main_audio_input: Which input has main audio
        
    Returns:
        Tuple of (filter_complex, additional_inputs)
    """
    mixer_config = AudioMixConfig(**config) if config else AudioMixConfig()
    mixer = AudioMixer(mixer_config)
    
    for track_data in tracks:
        track_type = TrackType(track_data.get('track_type', 'main'))
        track = AudioTrack(
            id=track_data.get('id', f'track_{len(mixer.tracks)}'),
            track_type=track_type,
            file_path=track_data.get('file_path'),
            start_time=track_data.get('start_time', 0),
            end_time=track_data.get('end_time', 0),
            source_start=track_data.get('source_start', 0),
            volume_db=track_data.get('volume_db'),
            fade_in=track_data.get('fade_in', 0),
            fade_out=track_data.get('fade_out', 0),
            duck_under_speech=track_data.get('duck_under_speech', True),
        )
        mixer.add_track(track)
    
    return mixer.generate_filter_complex(
        input_count=1,
        main_audio_input=main_audio_input,
    )


def create_simple_mix(
    main_volume_db: float = 0.0,
    music_path: Optional[str] = None,
    music_volume_db: float = -18.0,
    duration: float = 0.0,
) -> Tuple[str, List[str]]:
    """
    Create a simple 2-track mix (main + music).
    
    Args:
        main_volume_db: Volume for main audio
        music_path: Path to music file (optional)
        music_volume_db: Volume for music
        duration: Total duration
        
    Returns:
        Tuple of (filter_complex, additional_inputs)
    """
    mixer = AudioMixer()
    mixer.add_main_audio(volume_db=main_volume_db, end_time=duration)
    
    if music_path:
        mixer.add_music(
            file_path=music_path,
            start_time=0,
            end_time=duration,
            volume_db=music_volume_db,
        )
    
    return mixer.generate_filter_complex()


# CLI for testing
if __name__ == "__main__":
    # Example usage
    mixer = AudioMixer()
    
    # Add main dialogue
    mixer.add_main_audio(end_time=60.0)
    
    # Add background music
    mixer.add_music(
        file_path="/path/to/music.mp3",
        start_time=0,
        end_time=60.0,
        volume_db=-18.0,
    )
    
    # Add a B-roll segment with its audio
    mixer.add_broll_audio(
        file_path="/path/to/broll.mp4",
        start_time=10.0,
        end_time=15.0,
        volume_db=-12.0,
    )
    
    # Add a sound effect
    mixer.add_sfx(
        file_path="/path/to/whoosh.wav",
        start_time=10.0,
        volume_db=-6.0,
    )
    
    filter_complex, inputs = mixer.generate_filter_complex()
    
    print("Filter complex:")
    print(filter_complex)
    print("\nAdditional inputs:")
    for inp in inputs:
        print(f"  -i {inp}")
