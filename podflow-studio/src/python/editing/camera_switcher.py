#!/usr/bin/env python3
"""
Camera Switching Engine

Generates intelligent camera cuts based on:
1. Speaker diarization (who is talking)
2. Speaker-to-camera mapping
3. Pacing preferences
4. Reaction shot rules

Output is a list of camera cuts with timestamps.
"""

import json
import random
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, asdict


@dataclass
class CameraInput:
    """A camera input in the multi-cam setup."""
    id: str
    name: str
    file_path: str
    speaker_id: Optional[str] = None  # Maps to speaker from diarization
    is_main: bool = False  # Wide shot / fallback camera
    is_reaction: bool = False  # Good for reaction shots


@dataclass
class CameraCut:
    """A single camera cut decision."""
    id: str
    camera_id: str
    start_time: float
    end_time: float
    reason: str  # 'speaker-change', 'reaction-shot', 'variety', 'manual'
    confidence: float = 0.9
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            'duration': self.duration,
        }


@dataclass
class SpeakerSegment:
    """Speaker segment from diarization."""
    speaker_id: str
    speaker_label: str
    start_time: float
    end_time: float
    confidence: float


@dataclass
class CameraSwitchingResult:
    """Complete camera switching result."""
    cuts: List[CameraCut]
    total_duration: float
    cut_count: int
    average_cut_length: float
    cameras_used: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'cuts': [c.to_dict() for c in self.cuts],
            'total_duration': self.total_duration,
            'cut_count': self.cut_count,
            'average_cut_length': self.average_cut_length,
            'cameras_used': self.cameras_used,
        }


class CameraSwitcher:
    """
    Generates camera cuts based on speaker segments and pacing rules.
    """
    
    def __init__(
        self,
        cameras: List[CameraInput],
        speaker_to_camera: Dict[str, str],
        pacing: str = "moderate",
        min_cut_duration: float = 2.0,
        max_cut_duration: float = 30.0,
        reaction_shot_probability: float = 0.15,
        variety_threshold: float = 20.0,  # Max seconds on same camera before variety cut
    ):
        """
        Initialize camera switcher.
        
        Args:
            cameras: List of camera inputs
            speaker_to_camera: Mapping of speaker_id to camera_id
            pacing: 'fast', 'moderate', or 'slow'
            min_cut_duration: Minimum time on a camera
            max_cut_duration: Maximum time before forcing a cut
            reaction_shot_probability: Chance of inserting reaction shot
            variety_threshold: Max seconds on same camera before variety cut
        """
        self.cameras = {c.id: c for c in cameras}
        self.speaker_to_camera = speaker_to_camera
        self.pacing = pacing
        
        # Adjust timing based on pacing
        if pacing == "fast":
            self.min_cut_duration = max(1.0, min_cut_duration * 0.5)
            self.max_cut_duration = max_cut_duration * 0.5
            self.reaction_shot_probability = reaction_shot_probability * 1.5
            self.variety_threshold = variety_threshold * 0.5
        elif pacing == "slow":
            self.min_cut_duration = min_cut_duration * 1.5
            self.max_cut_duration = max_cut_duration * 2.0
            self.reaction_shot_probability = reaction_shot_probability * 0.5
            self.variety_threshold = variety_threshold * 2.0
        else:
            self.min_cut_duration = min_cut_duration
            self.max_cut_duration = max_cut_duration
            self.reaction_shot_probability = reaction_shot_probability
            self.variety_threshold = variety_threshold
        
        # Find main/fallback camera
        self.main_camera = next(
            (c for c in cameras if c.is_main),
            cameras[0] if cameras else None
        )
        
        # Find reaction shot cameras
        self.reaction_cameras = [c for c in cameras if c.is_reaction]
        if not self.reaction_cameras:
            # Use non-main cameras for reactions
            self.reaction_cameras = [c for c in cameras if not c.is_main]
    
    def get_camera_for_speaker(self, speaker_id: str) -> Optional[CameraInput]:
        """Get the camera assigned to a speaker."""
        camera_id = self.speaker_to_camera.get(speaker_id)
        if camera_id and camera_id in self.cameras:
            return self.cameras[camera_id]
        return self.main_camera
    
    def should_insert_reaction(self, current_duration: float, speaker_count: int) -> bool:
        """Decide if we should insert a reaction shot."""
        if speaker_count <= 1:
            return False
        if current_duration < self.min_cut_duration:
            return False
        return random.random() < self.reaction_shot_probability
    
    def get_reaction_camera(self, current_camera_id: str, speaking_camera_id: str) -> Optional[CameraInput]:
        """Get a camera for reaction shot (different from current and speaking)."""
        candidates = [
            c for c in self.reaction_cameras
            if c.id != current_camera_id and c.id != speaking_camera_id
        ]
        if not candidates:
            candidates = [c for c in self.cameras.values() if c.id != current_camera_id]
        return random.choice(candidates) if candidates else None
    
    def generate_cuts(
        self,
        speaker_segments: List[SpeakerSegment],
        total_duration: float,
    ) -> CameraSwitchingResult:
        """
        Generate camera cuts from speaker segments.
        
        Args:
            speaker_segments: List of speaker segments from diarization
            total_duration: Total video duration
            
        Returns:
            CameraSwitchingResult with optimized cuts
        """
        if not speaker_segments:
            # No speaker info - use main camera for everything
            if self.main_camera:
                return CameraSwitchingResult(
                    cuts=[CameraCut(
                        id="cut_0",
                        camera_id=self.main_camera.id,
                        start_time=0.0,
                        end_time=total_duration,
                        reason="fallback",
                    )],
                    total_duration=total_duration,
                    cut_count=1,
                    average_cut_length=total_duration,
                    cameras_used=[self.main_camera.id],
                )
            return CameraSwitchingResult(
                cuts=[],
                total_duration=total_duration,
                cut_count=0,
                average_cut_length=0,
                cameras_used=[],
            )
        
        cuts: List[CameraCut] = []
        cut_id = 0
        current_camera = self.main_camera
        current_cut_start = 0.0
        time_on_current_camera = 0.0
        
        # Sort segments by start time
        sorted_segments = sorted(speaker_segments, key=lambda s: s.start_time)
        
        # Track unique speakers for reaction shots
        unique_speakers = set(s.speaker_id for s in sorted_segments)
        
        for i, segment in enumerate(sorted_segments):
            speaker_camera = self.get_camera_for_speaker(segment.speaker_id)
            
            # Determine if we should cut
            should_cut = False
            cut_reason = ""
            next_camera = speaker_camera
            
            # 1. Speaker changed - follow the speaker
            if speaker_camera and speaker_camera.id != current_camera.id:
                if segment.start_time - current_cut_start >= self.min_cut_duration:
                    should_cut = True
                    cut_reason = "speaker-change"
                    next_camera = speaker_camera
            
            # 2. Been on same camera too long - add variety
            elif time_on_current_camera >= self.variety_threshold:
                should_cut = True
                cut_reason = "variety"
                # Get a different camera
                other_cameras = [c for c in self.cameras.values() if c.id != current_camera.id]
                if other_cameras:
                    next_camera = random.choice(other_cameras)
            
            # 3. Reaction shot opportunity
            elif self.should_insert_reaction(time_on_current_camera, len(unique_speakers)):
                reaction_cam = self.get_reaction_camera(
                    current_camera.id,
                    speaker_camera.id if speaker_camera else ""
                )
                if reaction_cam:
                    should_cut = True
                    cut_reason = "reaction-shot"
                    next_camera = reaction_cam
            
            # Execute cut
            if should_cut and next_camera:
                # End current cut
                cut_end = segment.start_time
                
                # Don't make cuts too short
                if cut_end - current_cut_start >= self.min_cut_duration:
                    cuts.append(CameraCut(
                        id=f"cut_{cut_id}",
                        camera_id=current_camera.id,
                        start_time=current_cut_start,
                        end_time=cut_end,
                        reason=cuts[-1].reason if cuts else "initial",
                    ))
                    cut_id += 1
                    
                    # Start new cut
                    current_cut_start = cut_end
                    current_camera = next_camera
                    time_on_current_camera = 0.0
            
            # Update time tracking
            time_on_current_camera += segment.end_time - segment.start_time
        
        # Add final cut
        if current_cut_start < total_duration:
            cuts.append(CameraCut(
                id=f"cut_{cut_id}",
                camera_id=current_camera.id,
                start_time=current_cut_start,
                end_time=total_duration,
                reason="speaker-change" if cuts else "initial",
            ))
        
        # Calculate stats
        cameras_used = list(set(c.camera_id for c in cuts))
        total_cut_duration = sum(c.duration for c in cuts)
        avg_cut_length = total_cut_duration / len(cuts) if cuts else 0
        
        return CameraSwitchingResult(
            cuts=cuts,
            total_duration=total_duration,
            cut_count=len(cuts),
            average_cut_length=avg_cut_length,
            cameras_used=cameras_used,
        )


def generate_camera_cuts(
    cameras: List[Dict[str, Any]],
    speaker_segments: List[Dict[str, Any]],
    speaker_to_camera: Dict[str, str],
    total_duration: float,
    pacing: str = "moderate",
    min_cut_duration: float = 2.0,
    max_cut_duration: float = 30.0,
    reaction_shot_probability: float = 0.15,
) -> CameraSwitchingResult:
    """
    Main entry point for generating camera cuts.
    
    Args:
        cameras: List of camera dicts with id, name, file_path, speaker_id, is_main
        speaker_segments: List of segment dicts with speaker_id, start_time, end_time
        speaker_to_camera: Mapping of speaker_id to camera_id
        total_duration: Total video duration
        pacing: 'fast', 'moderate', or 'slow'
        min_cut_duration: Minimum time on a camera
        max_cut_duration: Maximum time before forcing a cut
        reaction_shot_probability: Chance of inserting reaction shot
        
    Returns:
        CameraSwitchingResult with optimized cuts
    """
    # Convert dicts to dataclasses
    camera_inputs = [
        CameraInput(
            id=c['id'],
            name=c.get('name', c['id']),
            file_path=c.get('file_path', ''),
            speaker_id=c.get('speaker_id'),
            is_main=c.get('is_main', False),
            is_reaction=c.get('is_reaction', False),
        )
        for c in cameras
    ]
    
    speaker_segs = [
        SpeakerSegment(
            speaker_id=s['speaker_id'],
            speaker_label=s.get('speaker_label', s['speaker_id']),
            start_time=s['start_time'],
            end_time=s['end_time'],
            confidence=s.get('confidence', 0.9),
        )
        for s in speaker_segments
    ]
    
    switcher = CameraSwitcher(
        cameras=camera_inputs,
        speaker_to_camera=speaker_to_camera,
        pacing=pacing,
        min_cut_duration=min_cut_duration,
        max_cut_duration=max_cut_duration,
        reaction_shot_probability=reaction_shot_probability,
    )
    
    return switcher.generate_cuts(speaker_segs, total_duration)


def optimize_cuts_for_pacing(
    cuts: List[CameraCut],
    target_average: float,
    total_duration: float,
) -> List[CameraCut]:
    """
    Optimize existing cuts to match target pacing.
    
    Args:
        cuts: Existing camera cuts
        target_average: Target average cut duration
        total_duration: Total video duration
        
    Returns:
        Optimized list of cuts
    """
    if not cuts:
        return cuts
    
    current_average = sum(c.duration for c in cuts) / len(cuts)
    
    if abs(current_average - target_average) < 1.0:
        # Already close enough
        return cuts
    
    # Need to add or remove cuts
    optimized = []
    
    for cut in cuts:
        if cut.duration > target_average * 2:
            # Split long cuts
            num_splits = int(cut.duration / target_average)
            split_duration = cut.duration / num_splits
            
            for i in range(num_splits):
                optimized.append(CameraCut(
                    id=f"{cut.id}_{i}",
                    camera_id=cut.camera_id,
                    start_time=cut.start_time + i * split_duration,
                    end_time=cut.start_time + (i + 1) * split_duration,
                    reason="pacing-split" if i > 0 else cut.reason,
                    confidence=cut.confidence * 0.9,
                ))
        elif cut.duration < target_average * 0.3 and optimized:
            # Merge very short cuts with previous
            prev = optimized[-1]
            optimized[-1] = CameraCut(
                id=prev.id,
                camera_id=prev.camera_id,
                start_time=prev.start_time,
                end_time=cut.end_time,
                reason=prev.reason,
                confidence=prev.confidence,
            )
        else:
            optimized.append(cut)
    
    return optimized


# CLI for testing
if __name__ == "__main__":
    import sys
    
    # Example usage
    cameras = [
        {"id": "cam1", "name": "Wide Shot", "file_path": "", "is_main": True},
        {"id": "cam2", "name": "Host Camera", "file_path": "", "speaker_id": "SPEAKER_00"},
        {"id": "cam3", "name": "Guest Camera", "file_path": "", "speaker_id": "SPEAKER_01"},
    ]
    
    speaker_segments = [
        {"speaker_id": "SPEAKER_00", "start_time": 0, "end_time": 5},
        {"speaker_id": "SPEAKER_01", "start_time": 5, "end_time": 12},
        {"speaker_id": "SPEAKER_00", "start_time": 12, "end_time": 18},
        {"speaker_id": "SPEAKER_01", "start_time": 18, "end_time": 30},
        {"speaker_id": "SPEAKER_00", "start_time": 30, "end_time": 45},
    ]
    
    speaker_to_camera = {
        "SPEAKER_00": "cam2",
        "SPEAKER_01": "cam3",
    }
    
    result = generate_camera_cuts(
        cameras=cameras,
        speaker_segments=speaker_segments,
        speaker_to_camera=speaker_to_camera,
        total_duration=45.0,
        pacing="moderate",
    )
    
    print(f"Generated {result.cut_count} cuts")
    print(f"Average cut length: {result.average_cut_length:.2f}s")
    print(f"Cameras used: {result.cameras_used}")
    print("\nCuts:")
    for cut in result.cuts:
        print(f"  [{cut.start_time:.2f} - {cut.end_time:.2f}] {cut.camera_id} ({cut.reason})")
