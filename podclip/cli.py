#!/usr/bin/env python3
"""
PodClip CLI - Simple Deterministic Podcast Clip Generator

Usage:
    python -m podclip.cli input.mp4 --out clips/
    python -m podclip.cli input.mp4 --angles cam1.mp4 cam2.mp4 --out clips/

Pipeline:
    1. Extract audio from video
    2. Transcribe with Whisper (word-level timestamps)
    3. Detect clip candidates (deterministic)
    4. Generate karaoke captions
    5. Export vertical clips with burned-in captions
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path


def print_step(step: int, total: int, message: str):
    """Print a pipeline step."""
    print(f"[{step}/{total}] {message}")


def main():
    parser = argparse.ArgumentParser(
        description="PodClip - Simple Deterministic Podcast Clip Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Basic usage - generate clips from a podcast
    python -m podclip.cli podcast.mp4 --out clips/

    # With multiple camera angles
    python -m podclip.cli podcast.mp4 --angles cam1.mp4 cam2.mp4 --out clips/

    # Specify number of clips and duration range
    python -m podclip.cli podcast.mp4 --out clips/ --count 10 --min-duration 15 --max-duration 45

    # Skip intro/outro
    python -m podclip.cli podcast.mp4 --out clips/ --skip-intro 60 --skip-outro 30
"""
    )
    
    parser.add_argument(
        "input",
        help="Input video file (mp4, mov, mkv)"
    )
    
    parser.add_argument(
        "--out", "-o",
        default="clips",
        help="Output directory for clips (default: clips/)"
    )
    
    parser.add_argument(
        "--angles",
        nargs="+",
        help="Additional camera angles (for angle switching)"
    )
    
    parser.add_argument(
        "--broll",
        nargs="+",
        help="B-roll video files (for overlay)"
    )
    
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=10,
        help="Number of clips to generate (default: 10)"
    )
    
    parser.add_argument(
        "--min-duration",
        type=float,
        default=15.0,
        help="Minimum clip duration in seconds (default: 15)"
    )
    
    parser.add_argument(
        "--max-duration",
        type=float,
        default=60.0,
        help="Maximum clip duration in seconds (default: 60)"
    )
    
    parser.add_argument(
        "--skip-intro",
        type=float,
        default=30.0,
        help="Seconds to skip at start (default: 30)"
    )
    
    parser.add_argument(
        "--skip-outro",
        type=float,
        default=30.0,
        help="Seconds to skip at end (default: 30)"
    )
    
    parser.add_argument(
        "--no-captions",
        action="store_true",
        help="Disable caption burning"
    )
    
    parser.add_argument(
        "--caption-style",
        choices=["viral", "minimal", "bold"],
        default="viral",
        help="Caption style (default: viral)"
    )
    
    parser.add_argument(
        "--api-key",
        help="OpenAI API key (or set OPENAI_API_KEY env var)"
    )
    
    parser.add_argument(
        "--cache-dir",
        help="Directory to cache intermediate files"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.isfile(args.input):
        print(f"Error: Input file not found: {args.input}")
        sys.exit(1)
    
    # Import pipeline modules
    try:
        from .input import load_video, extract_audio
        from .transcription import transcribe, Transcript
        from .detection import detect_candidates, score_and_rank
        from .captions import generate_captions, CaptionStyle
        from .export import export_batch, get_video_dimensions
    except ImportError as e:
        print(f"Error: Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        sys.exit(1)
    
    total_steps = 6
    
    # Create output directory
    os.makedirs(args.out, exist_ok=True)
    
    # Create cache/temp directory
    if args.cache_dir:
        cache_dir = args.cache_dir
        os.makedirs(cache_dir, exist_ok=True)
    else:
        cache_dir = tempfile.mkdtemp(prefix="podclip_")
    
    try:
        # Step 1: Load and validate video
        print_step(1, total_steps, "Loading video...")
        video_info = load_video(args.input)
        print(f"    Duration: {video_info.duration:.1f}s")
        print(f"    Resolution: {video_info.width}x{video_info.height}")
        
        # Step 2: Extract audio
        print_step(2, total_steps, "Extracting audio...")
        audio_path = os.path.join(cache_dir, "audio.wav")
        
        # Check for cached audio
        if not os.path.isfile(audio_path):
            extract_audio(args.input, audio_path, sample_rate=16000)
        else:
            print("    (using cached audio)")
        
        # Step 3: Transcribe
        print_step(3, total_steps, "Transcribing with Whisper...")
        transcript_path = os.path.join(cache_dir, "transcript.json")
        
        # Check for cached transcript
        if os.path.isfile(transcript_path):
            print("    (using cached transcript)")
            with open(transcript_path, 'r') as f:
                from .transcription.whisper import load_transcript_from_json
                transcript = load_transcript_from_json(json.load(f))
        else:
            api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
            if not api_key:
                print("    Warning: No OpenAI API key - using empty transcript")
                transcript = Transcript(text="", words=[], segments=[], duration=video_info.duration)
            else:
                transcript = transcribe(audio_path, api_key)
                # Cache transcript
                from .transcription.whisper import transcript_to_json
                with open(transcript_path, 'w') as f:
                    json.dump(transcript_to_json(transcript), f, indent=2)
        
        print(f"    Words: {len(transcript.words)}")
        print(f"    Segments: {len(transcript.segments)}")
        
        # Step 4: Detect clip candidates
        print_step(4, total_steps, "Detecting clip candidates...")
        candidates = detect_candidates(
            transcript,
            min_duration=args.min_duration,
            max_duration=args.max_duration,
            skip_intro=args.skip_intro,
            skip_outro=args.skip_outro
        )
        print(f"    Found {len(candidates)} candidates")
        
        # Score and rank
        clips = score_and_rank(
            candidates,
            transcript,
            top_n=args.count,
            min_gap=30.0
        )
        print(f"    Selected {len(clips)} clips")
        
        if not clips:
            print("\nNo clips detected. Try adjusting parameters.")
            sys.exit(0)
        
        # Step 5: Generate captions
        if not args.no_captions:
            print_step(5, total_steps, "Generating captions...")
            caption_dir = os.path.join(args.out, "captions")
            os.makedirs(caption_dir, exist_ok=True)
            
            style_map = {
                "viral": CaptionStyle.VIRAL,
                "minimal": CaptionStyle.MINIMAL,
                "bold": CaptionStyle.BOLD,
            }
            caption_style = style_map.get(args.caption_style, CaptionStyle.VIRAL)
            
            from .captions import CaptionSettings
            caption_settings = CaptionSettings(style=caption_style)
            
            for clip in clips:
                caption_path = os.path.join(caption_dir, f"{clip.id}.ass")
                generate_captions(
                    transcript,
                    clip.start,
                    clip.end,
                    caption_path,
                    caption_settings
                )
            
            print(f"    Generated {len(clips)} caption files")
        else:
            caption_dir = None
            print_step(5, total_steps, "Skipping captions...")
        
        # Step 6: Export clips
        print_step(6, total_steps, "Exporting vertical clips...")
        
        def progress_callback(current, total, clip_id):
            print(f"    Exporting {clip_id} ({current}/{total})...")
        
        clip_dicts = [
            {"id": c.id, "start": c.start, "end": c.end}
            for c in clips
        ]
        
        exported = export_batch(
            clips=clip_dicts,
            source_file=args.input,
            output_dir=args.out,
            input_width=video_info.width,
            input_height=video_info.height,
            caption_dir=caption_dir,
            progress_callback=progress_callback
        )
        
        # Save clip metadata
        metadata_path = os.path.join(args.out, "clips.json")
        with open(metadata_path, 'w') as f:
            json.dump([c.to_dict() for c in clips], f, indent=2)
        
        print(f"\n✓ Exported {len(exported)} clips to {args.out}/")
        print(f"  Metadata saved to {metadata_path}")
        
        # Print summary
        print("\nClip Summary:")
        print("-" * 60)
        for clip in clips:
            print(f"  {clip.id}: {clip.start:.1f}s - {clip.end:.1f}s (score: {clip.score})")
        
    finally:
        # Clean up temp directory if not using cache
        if not args.cache_dir:
            import shutil
            try:
                shutil.rmtree(cache_dir)
            except Exception:
                pass


if __name__ == "__main__":
    main()
