#!/usr/bin/env python3
"""
Clipper Studio CLI - Terminal-first clip detection and validation.

Usage:
    # Basic run
    podclip input.mp4 --out clips/
    
    # Strict mode (CI-style, fails on any error)
    podclip input.mp4 --out clips/ --strict
    
    # Validation-only (for debugging)
    podclip validate clips/clip_003.json
    
    # Just detect without export
    podclip input.mp4 --detect-only

Exit codes:
    0 = success
    1 = recoverable failures fixed
    2 = hard failure (clips dropped or strict mode failed)
"""

import argparse
import json
import os
import sys
from typing import Optional, List, Dict


# Exit codes
EXIT_SUCCESS = 0
EXIT_RECOVERABLE = 1  # Recoverable failures were fixed
EXIT_HARD_FAILURE = 2  # Hard failure, clips dropped


def print_status(clip_id: str, message: str, symbol: str = "✓"):
    """Print a status message for a clip."""
    print(f"[{clip_id}]")
    print(f"{symbol} {message}")


def print_error(clip_id: str, message: str):
    """Print an error message."""
    print(f"[{clip_id}]")
    print(f"✗ {message}")


def print_fix(clip_id: str, message: str):
    """Print a fix message."""
    print(f"↻ {message}")


def run_detect(
    input_path: str,
    output_dir: Optional[str] = None,
    strict: bool = False,
    detect_only: bool = False,
    debug: bool = False,
) -> int:
    """
    Run the full detection → validate → fix → export pipeline.
    
    Args:
        input_path: Path to input video
        output_dir: Output directory for clips
        strict: If True, fail on any validation error
        detect_only: If True, only detect, don't export
        debug: Enable debug output
    
    Returns:
        Exit code (0, 1, or 2)
    """
    from detector import main as run_detection_pipeline
    from validate import ValidationRunner, ClipValidator, CaptionValidator
    from autofix import AutoFixRunner
    
    print(f"Processing: {input_path}")
    print(f"Output: {output_dir or '(detect only)'}")
    print(f"Mode: {'strict' if strict else 'normal'}")
    print()
    
    # Step 1: Run detection
    print("=" * 60)
    print("DETECTION")
    print("=" * 60)
    
    # Capture detection output
    import io
    import contextlib
    
    captured_output = io.StringIO()
    detection_result = None
    
    # Run the detector and capture its JSON output
    try:
        # We need to modify how detector works to return results
        # For now, let's use a simplified approach
        from pipeline import run_pipeline
        detection_result = run_pipeline(input_path, debug=debug)
    except ImportError:
        # Fallback: run detector directly
        print("Running detection...")
        # This would need integration work
        print("(Detection integration pending)")
        return EXIT_HARD_FAILURE
    
    if detection_result is None or 'clips' not in detection_result:
        print("✗ Detection failed - no clips found")
        return EXIT_HARD_FAILURE
    
    clips = detection_result['clips']
    transcript_words = detection_result.get('transcript', {}).get('words', [])
    
    print(f"✓ Detected {len(clips)} clips")
    print()
    
    # Step 2: Validate
    print("=" * 60)
    print("VALIDATION")
    print("=" * 60)
    
    validator = ValidationRunner()
    validation_report = validator.validate_batch(
        clips=clips,
        transcript_words=transcript_words,
    )
    
    print(validation_report.summary)
    print()
    
    # Print detailed validation results
    for report in validation_report.reports:
        if report.valid:
            print(f"[{report.clip_id}]")
            clip = next((c for c in clips if c.get('id') == report.clip_id), {})
            duration = clip.get('duration', clip.get('end', 0) - clip.get('start', 0))
            print(f"✓ duration valid ({duration:.1f}s)")
            print(f"✓ structure valid")
        else:
            print(f"[{report.clip_id}]")
            for error in report.all_errors:
                print(f"✗ {error.message}")
    print()
    
    # In strict mode, fail if any validation errors
    if strict and validation_report.invalid > 0:
        print("✗ Strict mode: validation errors found")
        return EXIT_HARD_FAILURE
    
    # Step 3: Auto-fix
    has_fixes = False
    had_hard_failures = False
    
    if validation_report.invalid > 0:
        print("=" * 60)
        print("AUTO-FIX")
        print("=" * 60)
        
        fixer = AutoFixRunner()
        
        # Convert validation reports to error dicts for fixer
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
            clips=clips,
            validation_results=validation_dicts,
            transcript_words=transcript_words,
        )
        
        print(fix_result.summary)
        print()
        
        # Update clips with fixed versions
        fixed_clips = []
        for result in fix_result.results:
            if result.dropped:
                print(f"[{result.clip_id}]")
                print(f"✗ dropped - unfixable errors: {', '.join(result.remaining_errors)}")
                had_hard_failures = True
            else:
                if result.fixes_applied:
                    print(f"[{result.clip_id}]")
                    for fix in result.fixes_applied:
                        print(f"↻ {fix}")
                    print(f"✓ fixed")
                    has_fixes = True
                fixed_clips.append(result.clip)
        
        clips = fixed_clips
        print()
    
    # Step 4: Re-validate fixed clips
    if has_fixes:
        print("=" * 60)
        print("RE-VALIDATION")
        print("=" * 60)
        
        final_report = validator.validate_batch(
            clips=clips,
            transcript_words=transcript_words,
        )
        
        print(final_report.summary)
        
        if final_report.invalid > 0:
            print("✗ Some clips still invalid after fix")
            # Filter out still-invalid clips
            valid_clip_ids = {
                r.clip_id for r in final_report.reports if r.valid
            }
            clips = [c for c in clips if c.get('id') in valid_clip_ids]
            had_hard_failures = True
        print()
    
    # Step 5: Export (if not detect-only)
    if not detect_only and output_dir:
        print("=" * 60)
        print("EXPORT")
        print("=" * 60)
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Save clips JSON
        output_json = os.path.join(output_dir, "clips.json")
        with open(output_json, 'w') as f:
            json.dump({
                'clips': clips,
                'source': input_path,
                'validation': {
                    'total': len(clips),
                    'valid': len(clips),  # All remaining clips are valid
                },
            }, f, indent=2)
        
        print(f"✓ Saved {len(clips)} clips to {output_json}")
        
        # TODO: Actually export video clips using FFmpeg
        # This would call the export module
        print(f"→ Export {len(clips)} clips to {output_dir}")
        print()
    
    # Determine exit code
    if had_hard_failures:
        return EXIT_HARD_FAILURE
    elif has_fixes:
        return EXIT_RECOVERABLE
    else:
        return EXIT_SUCCESS


def run_validate(json_path: str, verbose: bool = True) -> int:
    """
    Run validation only on a clips JSON file.
    
    Args:
        json_path: Path to clips JSON file
        verbose: Print detailed output
    
    Returns:
        Exit code
    """
    from validate import ValidationRunner
    from validate.runner import load_clips_from_json
    
    print(f"Validating: {json_path}")
    print()
    
    try:
        clips, captions_by_clip = load_clips_from_json(json_path)
    except Exception as e:
        print(f"✗ Failed to load JSON: {e}")
        return EXIT_HARD_FAILURE
    
    if not clips:
        print("✗ No clips found in JSON")
        return EXIT_HARD_FAILURE
    
    validator = ValidationRunner()
    report = validator.validate_and_report(
        clips=clips,
        captions_by_clip=captions_by_clip,
        verbose=verbose,
    )
    
    if report.hard_failures > 0:
        return EXIT_HARD_FAILURE
    elif report.invalid > 0:
        return EXIT_RECOVERABLE
    else:
        return EXIT_SUCCESS


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Clipper Studio CLI - Terminal-first clip detection and validation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exit codes:
    0 = success
    1 = recoverable failures fixed
    2 = hard failure (clips dropped or strict mode failed)

Examples:
    # Basic detection and export
    podclip input.mp4 --out clips/
    
    # Strict mode (CI-style)
    podclip input.mp4 --out clips/ --strict
    
    # Validation only
    podclip validate clips.json
    
    # Detection without export
    podclip input.mp4 --detect-only
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Validate subcommand
    validate_parser = subparsers.add_parser(
        'validate',
        help='Validate a clips JSON file'
    )
    validate_parser.add_argument(
        'json_path',
        help='Path to clips JSON file'
    )
    validate_parser.add_argument(
        '-q', '--quiet',
        action='store_true',
        help='Quiet output'
    )
    
    # Main arguments (for detection)
    parser.add_argument(
        'input',
        nargs='?',
        help='Input video file path'
    )
    parser.add_argument(
        '-o', '--out',
        dest='output_dir',
        help='Output directory for clips'
    )
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Strict mode - fail on any validation error'
    )
    parser.add_argument(
        '--detect-only',
        action='store_true',
        help='Only run detection, skip export'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug output'
    )
    parser.add_argument(
        '-v', '--version',
        action='version',
        version='Clipper Studio CLI 1.0.0'
    )
    
    args = parser.parse_args()
    
    # Handle validate subcommand
    if args.command == 'validate':
        exit_code = run_validate(
            args.json_path,
            verbose=not args.quiet,
        )
        sys.exit(exit_code)
    
    # Handle main detection command
    if not args.input:
        parser.print_help()
        sys.exit(EXIT_HARD_FAILURE)
    
    if not os.path.exists(args.input):
        print(f"✗ Input file not found: {args.input}")
        sys.exit(EXIT_HARD_FAILURE)
    
    exit_code = run_detect(
        input_path=args.input,
        output_dir=args.output_dir,
        strict=args.strict,
        detect_only=args.detect_only,
        debug=args.debug,
    )
    
    # Print final status
    print("=" * 60)
    if exit_code == EXIT_SUCCESS:
        print("✓ COMPLETE - All clips valid")
    elif exit_code == EXIT_RECOVERABLE:
        print("✓ COMPLETE - Some clips fixed")
    else:
        print("✗ FAILED - Hard failures occurred")
    print("=" * 60)
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
