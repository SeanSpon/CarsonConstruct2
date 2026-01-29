"""
Podcast Test Runner

Test the story-first pipeline on a REAL podcast.
No UI. Just truth.

Usage:
    python run_podcast_test.py --file /path/to/podcast.mp4
    python run_podcast_test.py --youtube "https://youtube.com/watch?v=..."
    python run_podcast_test.py --transcript /path/to/transcript.json

What it does:
1. Loads/transcribes the podcast
2. Segments into candidate clips
3. Runs story-first pipeline
4. Prints detailed results
5. Saves survivors for review
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "podflow-studio", "src", "python"))

from core.narrative.unit import NarrativeUnit, NarrativeVerdict
from core.narrative.detector import _heuristic_narrative_detection, batch_detect_narrative_structure
from core.narrative.gate import apply_gates_batch, summarize_gate_results, GateType
from core.pipeline.story_pipeline import StoryPipeline, run_story_pipeline
from core.pipeline.config import PipelineConfig, load_config


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    END = "\033[0m"


def print_header():
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}  ClipBot Story-First Pipeline Test{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")


def print_section(title: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}▶ {title}{Colors.END}")
    print(f"{Colors.DIM}{'-'*50}{Colors.END}")


def segment_transcript(
    transcript: str,
    min_duration: float = 25.0,
    max_duration: float = 75.0,
) -> List[Dict[str, Any]]:
    """
    Segment a full transcript into clip candidates.
    
    Simple sentence-based segmentation.
    For production, use the actual whisper timestamps.
    """
    import re
    
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', transcript)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    segments = []
    current = {
        "id": "seg_0",
        "sentences": [],
        "start": 0.0,
        "end": 0.0,
    }
    
    seg_idx = 0
    current_time = 0.0
    
    for sentence in sentences:
        # Estimate duration (150 WPM)
        words = len(sentence.split())
        duration = (words / 150) * 60
        
        current["sentences"].append(sentence)
        current_time += duration
        current["end"] = current_time
        current["transcript"] = " ".join(current["sentences"])
        current["duration"] = current["end"] - current["start"]
        
        # Check if segment is in target range
        if current["duration"] >= min_duration:
            segments.append(current.copy())
            
            seg_idx += 1
            current = {
                "id": f"seg_{seg_idx}",
                "sentences": [],
                "start": current_time,
                "end": current_time,
            }
    
    # Add final segment if substantial
    if current.get("sentences") and current.get("duration", 0) >= 10:
        current["transcript"] = " ".join(current["sentences"])
        segments.append(current)
    
    return segments


def load_transcript_from_file(path: str) -> str:
    """Load transcript from various file formats."""
    ext = os.path.splitext(path)[1].lower()
    
    if ext == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Handle common transcript formats
            if isinstance(data, str):
                return data
            elif isinstance(data, dict):
                return data.get("text", data.get("transcript", str(data)))
            elif isinstance(data, list):
                # Word-level or segment-level
                texts = []
                for item in data:
                    if isinstance(item, dict):
                        texts.append(item.get("text", item.get("word", "")))
                    elif isinstance(item, str):
                        texts.append(item)
                return " ".join(texts)
    
    elif ext == ".txt":
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    
    elif ext == ".srt":
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            texts = []
            for line in lines:
                line = line.strip()
                if line and not line.isdigit() and "-->" not in line:
                    texts.append(line)
            return " ".join(texts)
    
    else:
        raise ValueError(f"Unsupported transcript format: {ext}")


def run_pipeline_test(
    segments: List[Dict[str, Any]],
    config: PipelineConfig = None,
    verbose: bool = True,
) -> Dict[str, Any]:
    """
    Run the story-first pipeline on segments.
    Returns detailed results.
    """
    if config is None:
        config = PipelineConfig()
    
    print_section("ANALYZING SEGMENTS")
    print(f"Total segments to analyze: {len(segments)}")
    
    # Step 1: Detect narrative structure
    narrative_units = []
    for seg in segments:
        unit = _heuristic_narrative_detection(
            clip_id=seg["id"],
            start_time=seg.get("start", 0.0),
            end_time=seg.get("end", 0.0),
            transcript=seg.get("transcript", ""),
            patterns=seg.get("patterns", []),
        )
        narrative_units.append(unit)
    
    # Step 2: Apply quality gates
    print_section("APPLYING QUALITY GATES")
    
    visual_metadata = [{"speech_ratio": 0.85, "boundary_score": 0.8}] * len(narrative_units)
    survivors, gate_reports = apply_gates_batch(narrative_units, visual_metadata)
    
    gate_summary = summarize_gate_results(gate_reports)
    
    # Detailed drop analysis
    drop_reasons = {}
    for report in gate_reports:
        if not report.all_passed:
            for gate in report.gates:
                if not gate.passed:
                    reason = gate.gate.value
                    drop_reasons[reason] = drop_reasons.get(reason, 0) + 1
    
    # Step 3: Rank survivors
    survivors_sorted = sorted(survivors, key=lambda u: u.confidence, reverse=True)
    final = survivors_sorted[:config.target_clips]
    
    return {
        "total_segments": len(segments),
        "total_analyzed": len(narrative_units),
        "survivors": len(final),
        "dropped": len(segments) - len(final),
        "drop_reasons": drop_reasons,
        "gate_summary": gate_summary,
        "clips": final,
        "all_reports": gate_reports,
    }


def print_results(results: Dict[str, Any], verbose: bool = True):
    """Print formatted results."""
    
    print_section("RESULTS SUMMARY")
    
    total = results["total_segments"]
    survivors = results["survivors"]
    dropped = results["dropped"]
    
    # Survival rate
    survival_rate = (survivors / total * 100) if total > 0 else 0
    
    rate_color = Colors.GREEN if survival_rate < 30 else Colors.YELLOW if survival_rate < 50 else Colors.RED
    
    print(f"  Segments analyzed:  {total}")
    print(f"  Clips surviving:    {Colors.GREEN}{survivors}{Colors.END}")
    print(f"  Clips dropped:      {Colors.RED}{dropped}{Colors.END}")
    print(f"  Survival rate:      {rate_color}{survival_rate:.1f}%{Colors.END}")
    
    # Gate interpretation
    if survival_rate < 20:
        print(f"\n  {Colors.GREEN}✓ STRICT - System is being selective (good!){Colors.END}")
    elif survival_rate < 40:
        print(f"\n  {Colors.GREEN}✓ BALANCED - Reasonable selectivity{Colors.END}")
    else:
        print(f"\n  {Colors.YELLOW}⚠ PERMISSIVE - Consider tightening gates{Colors.END}")
    
    # Drop reasons
    if results["drop_reasons"]:
        print_section("DROP REASONS")
        for reason, count in sorted(results["drop_reasons"].items(), key=lambda x: -x[1]):
            pct = (count / dropped * 100) if dropped > 0 else 0
            print(f"  {reason}: {count} ({pct:.0f}%)")
    
    # Surviving clips
    if results["clips"]:
        print_section("SURVIVING CLIPS")
        for i, clip in enumerate(results["clips"]):
            label = clip.confidence_label
            elements = []
            if clip.has_setup: elements.append("S")
            if clip.has_core: elements.append("C")
            if clip.has_resolution: elements.append("R")
            
            print(f"\n  {Colors.BOLD}[{i+1}] {clip.clip_id}{Colors.END} {label}")
            print(f"      Confidence: {clip.confidence:.0%}")
            print(f"      Elements: {'/'.join(elements) if elements else 'none'}")
            print(f"      Duration: {clip.duration:.0f}s")
            
            if verbose:
                # Show truncated transcript
                transcript = clip.transcript[:150] + "..." if len(clip.transcript) > 150 else clip.transcript
                print(f"      {Colors.DIM}\"{transcript}\"{Colors.END}")
    else:
        print_section("NO SURVIVORS")
        print(f"  {Colors.GREEN}✓ This is a valid result! No clips met quality bar.{Colors.END}")


def save_results(results: Dict[str, Any], output_dir: str):
    """Save results to JSON for review."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Prepare serializable results
    output = {
        "summary": {
            "total_segments": results["total_segments"],
            "survivors": results["survivors"],
            "dropped": results["dropped"],
            "survival_rate": results["survivors"] / results["total_segments"] if results["total_segments"] > 0 else 0,
        },
        "drop_reasons": results["drop_reasons"],
        "clips": [clip.to_dict() for clip in results["clips"]],
    }
    
    output_path = os.path.join(output_dir, "pipeline_results.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n{Colors.DIM}Results saved to: {output_path}{Colors.END}")


# Example transcript for testing
EXAMPLE_TRANSCRIPT = """
So here's the thing about building products. The key insight is that you have to start with the problem, not the solution. Most founders get this backwards. They build something cool and then try to find customers. But the successful ones? They find the pain first. And that's the difference between a hobby project and a real business.

Yeah, exactly. That's what I was saying.

The question everyone asks is how do you stay motivated. And the answer is simple. You don't rely on motivation. You build systems. You create habits. And eventually, showing up becomes automatic. That's the whole game.

And he was like, you know, the thing about that project is that we should probably reconsider the whole approach because of what happened last time with the other thing.

Let me tell you a story. When I was 22, I had nothing. No money, no connections, no idea what I was doing. I took a job at a startup that paid almost nothing. But I learned everything. I stayed late, I asked questions, I made myself useful. Three years later, I was running the product team. The lesson? Invest in learning, not comfort. The compound interest on skills is insane.

I think that's really interesting because, um, you know, there's a lot of ways to think about it and I'm not sure which one is right but it's definitely something to consider.

Here's the harsh truth about content. Most of it is noise. The stuff that wins? It has a clear point, it says something unexpected, and it leaves you thinking. That's it. Not fancy editing. Not viral hooks. Just: say something worth saying, clearly. If you can do that consistently, you win.

Right, right. Makes sense. So what's next for the company then?

The biggest mistake I see in startups is premature scaling. You get a little traction, you raise money, you hire a bunch of people. And then you realize the product-market fit wasn't as strong as you thought. Now you've got burn rate and pressure. The smart move? Stay small until you can't anymore. Until customers are literally begging for more. Then you scale.

Um, I don't know, maybe?

Here's what nobody tells you about success. It's mostly boring. The exciting parts are rare. Most days, you're just showing up, doing the work, making small improvements. The compound effect takes years. People see the outcome and think it was a breakthrough moment. But really it was a thousand invisible days of grinding.
"""


def main():
    parser = argparse.ArgumentParser(
        description="Test the story-first pipeline on a podcast"
    )
    parser.add_argument("--transcript", type=str, help="Path to transcript file (json, txt, srt)")
    parser.add_argument("--text", type=str, help="Raw transcript text")
    parser.add_argument("--example", action="store_true", help="Use built-in example transcript")
    parser.add_argument("--output", type=str, default="./test_output", help="Output directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--min-duration", type=float, default=25.0, help="Min segment duration")
    parser.add_argument("--max-duration", type=float, default=75.0, help="Max segment duration")
    
    args = parser.parse_args()
    
    print_header()
    
    # Get transcript
    if args.transcript:
        print(f"Loading transcript from: {args.transcript}")
        transcript = load_transcript_from_file(args.transcript)
    elif args.text:
        transcript = args.text
    elif args.example:
        print("Using built-in example transcript")
        transcript = EXAMPLE_TRANSCRIPT
    else:
        print("Usage: python run_podcast_test.py --example")
        print("       python run_podcast_test.py --transcript /path/to/transcript.txt")
        print("       python run_podcast_test.py --text \"Your transcript here...\"")
        return
    
    # Segment
    print_section("SEGMENTATION")
    segments = segment_transcript(
        transcript,
        min_duration=args.min_duration,
        max_duration=args.max_duration,
    )
    print(f"Created {len(segments)} segments from transcript")
    
    # Run pipeline
    results = run_pipeline_test(segments, verbose=args.verbose)
    
    # Print results
    print_results(results, verbose=args.verbose)
    
    # Save results
    save_results(results, args.output)
    
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}  Pipeline test complete!{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")


if __name__ == "__main__":
    main()
