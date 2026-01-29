#!/usr/bin/env python3
"""
Main ClipBot MVP Pipeline - Orchestrates all components.

This is the main entry point that takes a video and generates
story-complete short-form clips with captions and effects.

Usage:
    python clip_generator.py <video_path> <output_dir> [config_json]
"""
import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


class ClipGenerator:
    """
    Main pipeline orchestrator for ClipBot MVP.
    
    Coordinates:
    1. Transcription (Whisper)
    2. Story detection (NarrativeDetector)
    3. Video extraction and effects
    4. Caption rendering
    5. Export
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize clip generator.
        
        Args:
            config: Optional configuration dict
        """
        self.config = config or self._default_config()
        
        # Initialize components lazily
        self._transcription = None
        self._narrative = None
        self._captions = None
        self._effects = None
    
    def _default_config(self) -> Dict[str, Any]:
        """Return default pipeline configuration."""
        return {
            # Transcription settings
            'whisper_model': 'base',  # tiny, base, small, medium, large
            
            # Narrative detection settings
            'min_duration': 15,  # Minimum clip duration (seconds)
            'max_duration': 90,  # Maximum clip duration (seconds)
            'max_clips': 10,     # Maximum clips to generate
            'min_story_score': 40,  # Minimum story score threshold
            
            # Caption settings
            'caption_style': 'three_word_chunks',  # word_by_word, three_word_chunks
            'fontsize': 70,
            'font_color': 'white',
            'stroke_color': 'black',
            'stroke_width': 3,
            
            # Effects settings
            'cuts_per_minute': 10,
            'style_preset': 'storytelling',  # viral_fast, storytelling, educational, raw_authentic, hype
            
            # Output settings
            'output_format': 'mp4',
            'output_fps': 30,
            'output_codec': 'libx264',
            'output_audio_codec': 'aac',
            'output_preset': 'medium',  # ultrafast, fast, medium, slow
            
            # Vertical video settings
            'target_width': 1080,
            'target_height': 1920,
            'fill_mode': 'crop',  # crop or fit
        }
    
    @property
    def transcription(self):
        """Lazy load transcription service."""
        if self._transcription is None:
            from services.transcription import TranscriptionService
            self._transcription = TranscriptionService(
                model_size=self.config.get('whisper_model', 'base')
            )
        return self._transcription
    
    @property
    def narrative(self):
        """Lazy load narrative detector."""
        if self._narrative is None:
            from pipeline.narrative_detector import NarrativeDetector
            self._narrative = NarrativeDetector()
        return self._narrative
    
    @property
    def captions(self):
        """Lazy load caption renderer."""
        if self._captions is None:
            from rendering.caption_renderer import CaptionRenderer
            self._captions = CaptionRenderer(
                style=self.config.get('caption_style', 'three_word_chunks')
            )
        return self._captions
    
    @property
    def effects(self):
        """Lazy load video effects."""
        if self._effects is None:
            from rendering.video_effects import VideoEffects
            self._effects = VideoEffects()
        return self._effects
    
    def generate_clips(
        self,
        video_path: str,
        output_dir: str,
        progress_callback: Optional[callable] = None,
    ) -> List[Dict[str, Any]]:
        """
        Full pipeline: video -> clips.
        
        Args:
            video_path: Path to input video file
            output_dir: Directory to save clips
            progress_callback: Optional callback(percent, message) for progress updates
        
        Returns:
            List of generated clip metadata dicts
        """
        # Validate input
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        def report_progress(percent: int, message: str):
            """Report progress via callback and stdout."""
            print(f"PROGRESS:{percent}:{message}")
            if progress_callback:
                progress_callback(percent, message)
        
        print("\n🎬 Starting ClipBot MVP Pipeline")
        print("=" * 60)
        
        # Step 1: Transcribe (0-30%)
        report_progress(0, "Starting transcription...")
        transcript = self._step_transcribe(video_path, report_progress)
        
        # Step 2: Detect stories (30-40%)
        report_progress(30, "Detecting story segments...")
        segments = self._step_detect_stories(transcript, report_progress)
        
        if not segments:
            report_progress(100, "No story segments found")
            print("⚠️ No story segments found in video")
            return []
        
        # Step 3: Generate clips (40-95%)
        report_progress(40, f"Generating {len(segments)} clips...")
        clips = self._step_generate_clips(
            video_path, transcript, segments, output_dir, report_progress
        )
        
        # Step 4: Finalize (95-100%)
        report_progress(95, "Finalizing...")
        
        # Save metadata
        metadata_path = os.path.join(output_dir, 'clips_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(clips, f, indent=2)
        
        report_progress(100, f"Complete! Generated {len(clips)} clips")
        
        print(f"\n✅ Generated {len(clips)} clips")
        print(f"📁 Output: {os.path.abspath(output_dir)}")
        print("=" * 60)
        
        return clips
    
    def _step_transcribe(
        self,
        video_path: str,
        report_progress: callable
    ) -> Dict[str, Any]:
        """Step 1: Transcribe video."""
        print("\n[1/4] 📝 Transcribing video...")
        
        transcript = self.transcription.transcribe_video(video_path)
        
        word_count = len(transcript.get('words', []))
        print(f"      ✅ Transcribed {word_count} words")
        
        if word_count > 0:
            duration = transcript['words'][-1]['end']
            print(f"      ⏱️  Duration: {duration:.1f}s")
        
        report_progress(25, f"Transcribed {word_count} words")
        
        return transcript
    
    def _step_detect_stories(
        self,
        transcript: Dict[str, Any],
        report_progress: callable
    ) -> List[Dict[str, Any]]:
        """Step 2: Detect story segments."""
        print("\n[2/4] 📖 Detecting story segments...")
        
        segments = self.narrative.detect_story_segments(
            transcript,
            min_duration=self.config.get('min_duration', 15),
            max_duration=self.config.get('max_duration', 90),
            max_segments=self.config.get('max_clips', 10),
        )
        
        # Filter by minimum score
        min_score = self.config.get('min_story_score', 40)
        segments = [s for s in segments if s['story_score'] >= min_score]
        
        print(f"      ✅ Found {len(segments)} story segments")
        
        for i, seg in enumerate(segments[:3]):
            print(f"         #{i+1}: Score {seg['story_score']}, {seg['duration']:.1f}s")
        
        report_progress(35, f"Found {len(segments)} story segments")
        
        return segments
    
    def _step_generate_clips(
        self,
        video_path: str,
        transcript: Dict[str, Any],
        segments: List[Dict[str, Any]],
        output_dir: str,
        report_progress: callable
    ) -> List[Dict[str, Any]]:
        """Step 3: Generate video clips."""
        print("\n[3/4] 🎥 Generating clips...")
        
        try:
            from moviepy.editor import VideoFileClip
        except ImportError:
            raise ImportError("moviepy not installed. Run: pip install moviepy")
        
        # Load source video
        source_clip = VideoFileClip(video_path)
        clips = []
        
        all_words = transcript.get('words', [])
        total_segments = len(segments)
        
        for i, segment in enumerate(segments):
            # Calculate progress (40-95%)
            progress = 40 + int((i / total_segments) * 55)
            report_progress(progress, f"Processing clip {i+1}/{total_segments}")
            
            print(f"      Processing {i+1}/{total_segments}...")
            
            try:
                clip_data = self._generate_single_clip(
                    source_clip,
                    segment,
                    all_words,
                    output_dir,
                    i
                )
                clips.append(clip_data)
                print(f"         ✅ Clip {i+1} saved")
            except Exception as e:
                print(f"         ❌ Clip {i+1} failed: {e}")
                continue
        
        # Clean up
        source_clip.close()
        
        return clips
    
    def _generate_single_clip(
        self,
        source_clip: Any,
        segment: Dict[str, Any],
        all_words: List[Dict],
        output_dir: str,
        index: int
    ) -> Dict[str, Any]:
        """Generate a single clip from a segment."""
        from moviepy.editor import VideoFileClip
        
        # Extract segment from source
        clip = source_clip.subclip(segment['start_time'], segment['end_time'])
        
        # Get words for this segment (with relative timestamps)
        segment_words = []
        for w in all_words:
            if segment['start_time'] <= w['start'] <= segment['end_time']:
                segment_words.append({
                    'text': w['text'],
                    'start': w['start'] - segment['start_time'],
                    'end': w['end'] - segment['start_time'],
                })
        
        # Convert to vertical format
        clip = self.effects.convert_to_9_16(
            clip,
            target_width=self.config.get('target_width', 1080),
            target_height=self.config.get('target_height', 1920),
            fill_mode=self.config.get('fill_mode', 'crop')
        )
        
        # Apply dynamic cuts/effects
        clip = self.effects.apply_dynamic_cuts(
            clip,
            cuts_per_minute=self.config.get('cuts_per_minute', 10)
        )
        
        # Add captions
        caption_config = {
            'fontsize': self.config.get('fontsize', 70),
            'color': self.config.get('font_color', 'white'),
            'stroke_color': self.config.get('stroke_color', 'black'),
            'stroke_width': self.config.get('stroke_width', 3),
        }
        
        if segment_words:
            clip = self.captions.render(clip, segment_words, config=caption_config)
        
        # Generate output filename
        output_filename = f"clip_{index + 1:02d}.mp4"
        output_path = os.path.join(output_dir, output_filename)
        
        # Export
        clip.write_videofile(
            output_path,
            codec=self.config.get('output_codec', 'libx264'),
            audio_codec=self.config.get('output_audio_codec', 'aac'),
            fps=self.config.get('output_fps', 30),
            preset=self.config.get('output_preset', 'medium'),
            threads=4,
            verbose=False,
            logger=None,
        )
        
        # Clean up
        clip.close()
        
        return {
            'path': output_path,
            'filename': output_filename,
            'index': index + 1,
            'duration': segment['duration'],
            'story_score': segment['story_score'],
            'has_setup': segment['has_setup'],
            'has_conflict': segment['has_conflict'],
            'has_payoff': segment['has_payoff'],
            'engagement_score': segment['engagement_score'],
            'word_count': segment['word_count'],
            'text_preview': segment['text'][:200] if len(segment['text']) > 200 else segment['text'],
            'source_start': segment['start_time'],
            'source_end': segment['end_time'],
        }
    
    def generate_single_clip_at_time(
        self,
        video_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        transcript: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a single clip from specific timestamps.
        
        Useful for manual clip selection or re-export.
        
        Args:
            video_path: Input video path
            output_path: Output file path
            start_time: Start time in seconds
            end_time: End time in seconds
            transcript: Optional transcript (will transcribe chunk if not provided)
        
        Returns:
            Clip metadata dict
        """
        from moviepy.editor import VideoFileClip
        
        # Load video
        source_clip = VideoFileClip(video_path)
        clip = source_clip.subclip(start_time, end_time)
        
        # Get or create transcript for this segment
        if transcript is None:
            # Transcribe just this chunk
            chunk_transcript = self.transcription.transcribe_chunk(
                video_path, start_time, end_time
            )
            segment_words = chunk_transcript.get('words', [])
            # Adjust timestamps to be relative
            for w in segment_words:
                w['start'] -= start_time
                w['end'] -= start_time
        else:
            # Extract words from provided transcript
            segment_words = []
            for w in transcript.get('words', []):
                if start_time <= w['start'] <= end_time:
                    segment_words.append({
                        'text': w['text'],
                        'start': w['start'] - start_time,
                        'end': w['end'] - start_time,
                    })
        
        # Apply effects
        clip = self.effects.convert_to_9_16(clip)
        clip = self.effects.apply_dynamic_cuts(clip)
        
        # Add captions
        if segment_words:
            clip = self.captions.render(clip, segment_words)
        
        # Export
        clip.write_videofile(
            output_path,
            codec=self.config.get('output_codec', 'libx264'),
            audio_codec=self.config.get('output_audio_codec', 'aac'),
            fps=self.config.get('output_fps', 30),
            preset=self.config.get('output_preset', 'medium'),
            threads=4,
            verbose=False,
            logger=None,
        )
        
        # Clean up
        clip.close()
        source_clip.close()
        
        return {
            'path': output_path,
            'duration': end_time - start_time,
            'source_start': start_time,
            'source_end': end_time,
        }


def main():
    """CLI entry point."""
    if len(sys.argv) < 3:
        print("Usage: python clip_generator.py <video_path> <output_dir> [config_json]")
        print("\nExample:")
        print("  python clip_generator.py podcast.mp4 ./output")
        print('  python clip_generator.py podcast.mp4 ./output \'{"max_clips": 5}\'')
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Parse optional config
    config = None
    if len(sys.argv) > 3:
        try:
            config = json.loads(sys.argv[3])
        except json.JSONDecodeError as e:
            print(f"ERROR:Invalid config JSON: {e}")
            sys.exit(1)
    
    # Validate video exists
    if not os.path.exists(video_path):
        print(f"ERROR:Video file not found: {video_path}")
        sys.exit(1)
    
    # Run pipeline
    try:
        generator = ClipGenerator(config=config)
        clips = generator.generate_clips(video_path, output_dir)
        
        # Output results as JSON for Electron to parse
        print(f"RESULT:{json.dumps(clips)}")
        
    except Exception as e:
        print(f"ERROR:{str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
