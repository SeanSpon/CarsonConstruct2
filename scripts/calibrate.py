"""
Human Calibration Tool

Test the system's taste against YOUR taste.
Fast, terminal-based, no UI required.

How it works:
1. System analyzes segments
2. You see each segment + system verdict
3. You give YOUR verdict (Y/N)
4. Tool compares human vs system
5. Outputs calibration report

This is how you tune the gates.
"""

import os
import sys
import json
from typing import List, Dict, Any, Tuple

# Add core to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.narrative.unit import NarrativeUnit, NarrativeVerdict, create_narrative_unit
from core.narrative.detector import detect_narrative_structure, _heuristic_narrative_detection
from core.narrative.gate import apply_narrative_gate, GateReport
from core.pipeline.config import PipelineConfig


# ANSI colors for terminal
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    END = "\033[0m"


def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')


def print_header():
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.CYAN}  ClipBot Calibration Tool - Human vs System{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")


def print_segment(segment: Dict[str, Any], index: int, total: int):
    """Display a segment for human evaluation."""
    print(f"\n{Colors.BOLD}[Segment {index + 1} of {total}]{Colors.END}")
    print(f"{Colors.YELLOW}Duration: {segment.get('duration', 'N/A')}s{Colors.END}")
    print(f"\n{Colors.CYAN}--- TRANSCRIPT ---{Colors.END}")
    
    transcript = segment.get("transcript", "")
    # Wrap long transcripts
    words = transcript.split()
    lines = []
    current_line = []
    for word in words:
        current_line.append(word)
        if len(" ".join(current_line)) > 70:
            lines.append(" ".join(current_line))
            current_line = []
    if current_line:
        lines.append(" ".join(current_line))
    
    for line in lines:
        print(f"  {line}")
    
    print(f"{Colors.CYAN}------------------{Colors.END}")


def print_system_verdict(unit: NarrativeUnit, report: GateReport):
    """Show what the system decided."""
    verdict_color = Colors.GREEN if unit.is_shippable else Colors.RED
    verdict_text = "✅ PASS" if unit.is_shippable else "❌ DROP"
    
    print(f"\n{Colors.BOLD}SYSTEM VERDICT:{Colors.END} {verdict_color}{verdict_text}{Colors.END}")
    print(f"  Confidence: {unit.confidence:.0%} {unit.confidence_label}")
    print(f"  Story elements: {unit.story_element_count}/3 ", end="")
    elements = []
    if unit.has_setup: elements.append("setup")
    if unit.has_core: elements.append("core")
    if unit.has_resolution: elements.append("resolution")
    print(f"({', '.join(elements) if elements else 'none'})")
    
    if not unit.is_shippable:
        print(f"  {Colors.RED}Drop reason: {report.primary_failure}{Colors.END}")


def get_human_verdict() -> Tuple[bool, str]:
    """Ask human for their verdict."""
    print(f"\n{Colors.BOLD}YOUR VERDICT:{Colors.END}")
    print("  Would you ship this clip? (as-is, no editing)")
    print(f"  {Colors.GREEN}[Y]{Colors.END} Yes, ship it")
    print(f"  {Colors.RED}[N]{Colors.END} No, drop it")
    print(f"  {Colors.YELLOW}[M]{Colors.END} Maybe (borderline)")
    print(f"  {Colors.BLUE}[S]{Colors.END} Skip this one")
    print(f"  {Colors.CYAN}[Q]{Colors.END} Quit calibration")
    
    while True:
        response = input("\n  > ").strip().upper()
        if response in ["Y", "N", "M", "S", "Q"]:
            return response == "Y", response
        print("  Please enter Y, N, M, S, or Q")


def print_comparison(human_ship: bool, system_ship: bool, response: str):
    """Show the comparison between human and system."""
    if response == "M":
        print(f"\n{Colors.YELLOW}⚖️  BORDERLINE - System said {'PASS' if system_ship else 'DROP'}{Colors.END}")
    elif human_ship == system_ship:
        print(f"\n{Colors.GREEN}✓ AGREEMENT - Both say {'PASS' if system_ship else 'DROP'}{Colors.END}")
    else:
        if human_ship and not system_ship:
            print(f"\n{Colors.RED}⚠️  MISMATCH - You'd ship, system dropped (TOO STRICT?){Colors.END}")
        else:
            print(f"\n{Colors.RED}⚠️  MISMATCH - System passed, you'd drop (TOO PERMISSIVE!){Colors.END}")


def print_final_report(results: List[Dict[str, Any]]):
    """Print calibration summary."""
    clear_screen()
    print_header()
    
    total = len(results)
    if total == 0:
        print("No segments evaluated.")
        return
    
    agreements = sum(1 for r in results if r["agreement"])
    human_ships = sum(1 for r in results if r["human_ship"])
    system_ships = sum(1 for r in results if r["system_ship"])
    borderlines = sum(1 for r in results if r["response"] == "M")
    
    # Mismatches
    too_strict = sum(1 for r in results if r["human_ship"] and not r["system_ship"])
    too_permissive = sum(1 for r in results if not r["human_ship"] and r["system_ship"] and r["response"] != "M")
    
    print(f"{Colors.BOLD}CALIBRATION REPORT{Colors.END}")
    print(f"{'='*40}")
    print(f"\nTotal segments evaluated: {total}")
    print(f"\n{Colors.CYAN}AGREEMENT RATE:{Colors.END}")
    agreement_pct = (agreements / total) * 100 if total > 0 else 0
    color = Colors.GREEN if agreement_pct >= 80 else Colors.YELLOW if agreement_pct >= 60 else Colors.RED
    print(f"  {color}{agreement_pct:.0f}% ({agreements}/{total}){Colors.END}")
    
    print(f"\n{Colors.CYAN}VERDICTS:{Colors.END}")
    print(f"  Human would ship: {human_ships}/{total}")
    print(f"  System would ship: {system_ships}/{total}")
    print(f"  Borderline cases: {borderlines}")
    
    print(f"\n{Colors.CYAN}MISMATCHES:{Colors.END}")
    if too_strict > 0:
        print(f"  {Colors.YELLOW}System too STRICT: {too_strict} (you'd ship, system dropped){Colors.END}")
    if too_permissive > 0:
        print(f"  {Colors.RED}System too PERMISSIVE: {too_permissive} (system passed, you'd drop){Colors.END}")
    if too_strict == 0 and too_permissive == 0:
        print(f"  {Colors.GREEN}None! System matches your taste.{Colors.END}")
    
    # Recommendations
    print(f"\n{Colors.BOLD}RECOMMENDATIONS:{Colors.END}")
    if too_permissive > too_strict:
        print(f"  {Colors.RED}→ TIGHTEN gates. System is letting slop through.{Colors.END}")
        print(f"    Consider raising min_confidence or min_story_elements")
    elif too_strict > too_permissive:
        print(f"  {Colors.YELLOW}→ System may be too strict, but that's usually OK.{Colors.END}")
        print(f"    Only loosen if you're missing genuinely good clips.")
    else:
        print(f"  {Colors.GREEN}→ Gates seem well-calibrated. Ship it!{Colors.END}")
    
    print(f"\n{'='*40}\n")


# Sample test segments (use these or load from real podcast)
SAMPLE_SEGMENTS = [
    {
        "id": "sample_1",
        "start": 0.0,
        "end": 45.0,
        "duration": 45.0,
        "transcript": "So here's the thing about building products. The key insight is that you have to start with the problem, not the solution. Most founders get this backwards. They build something cool and then try to find customers. But the successful ones? They find the pain first. And that's the difference between a hobby project and a real business."
    },
    {
        "id": "sample_2",
        "start": 45.0,
        "end": 55.0,
        "duration": 10.0,
        "transcript": "Yeah, exactly. That's what I was saying."
    },
    {
        "id": "sample_3",
        "start": 55.0,
        "end": 100.0,
        "duration": 45.0,
        "transcript": "The question everyone asks is how do you stay motivated. And the answer is simple. You don't rely on motivation. You build systems. You create habits. And eventually, showing up becomes automatic. That's the whole game."
    },
    {
        "id": "sample_4",
        "start": 100.0,
        "end": 130.0,
        "duration": 30.0,
        "transcript": "And he was like, you know, the thing about that project is that we should probably reconsider the whole approach because of what happened last time with the other thing."
    },
    {
        "id": "sample_5",
        "start": 130.0,
        "end": 180.0,
        "duration": 50.0,
        "transcript": "Let me tell you a story. When I was 22, I had nothing. No money, no connections, no idea what I was doing. I took a job at a startup that paid almost nothing. But I learned everything. I stayed late, I asked questions, I made myself useful. Three years later, I was running the product team. The lesson? Invest in learning, not comfort. The compound interest on skills is insane."
    },
    {
        "id": "sample_6",
        "start": 180.0,
        "end": 210.0,
        "duration": 30.0,
        "transcript": "I think that's really interesting because, um, you know, there's a lot of ways to think about it and I'm not sure which one is right but it's definitely something to consider."
    },
    {
        "id": "sample_7",
        "start": 210.0,
        "end": 260.0,
        "duration": 50.0,
        "transcript": "Here's the harsh truth about content. Most of it is noise. The stuff that wins? It has a clear point, it says something unexpected, and it leaves you thinking. That's it. Not fancy editing. Not viral hooks. Just: say something worth saying, clearly. If you can do that consistently, you win."
    },
    {
        "id": "sample_8",
        "start": 260.0,
        "end": 280.0,
        "duration": 20.0,
        "transcript": "Right, right. Makes sense. So what's next for the company then?"
    },
]


def load_segments_from_file(filepath: str) -> List[Dict[str, Any]]:
    """Load segments from a JSON file."""
    with open(filepath, "r") as f:
        return json.load(f)


def run_calibration(segments: List[Dict[str, Any]] = None):
    """Run the human calibration loop."""
    if segments is None:
        segments = SAMPLE_SEGMENTS
    
    results = []
    
    clear_screen()
    print_header()
    print("This tool compares YOUR taste to SYSTEM taste.")
    print("For each segment, you'll see the transcript and decide: ship or drop?")
    print("\nPress Enter to start...")
    input()
    
    for i, segment in enumerate(segments):
        clear_screen()
        print_header()
        
        # Analyze with system
        unit = _heuristic_narrative_detection(
            clip_id=segment.get("id", f"seg_{i}"),
            start_time=segment.get("start", 0.0),
            end_time=segment.get("end", 0.0),
            transcript=segment.get("transcript", ""),
        )
        
        report = apply_narrative_gate(unit, {
            "speech_ratio": 0.85,
            "boundary_score": 0.9,
        })
        
        # Show segment
        print_segment(segment, i, len(segments))
        
        # Show system verdict
        print_system_verdict(unit, report)
        
        # Get human verdict
        human_ship, response = get_human_verdict()
        
        if response == "Q":
            print("\nQuitting calibration...")
            break
        
        if response == "S":
            print("\nSkipping...")
            continue
        
        # Compare
        print_comparison(human_ship, unit.is_shippable, response)
        
        # Record result
        results.append({
            "segment_id": segment.get("id"),
            "human_ship": human_ship,
            "system_ship": unit.is_shippable,
            "agreement": human_ship == unit.is_shippable,
            "response": response,
            "confidence": unit.confidence,
            "story_elements": unit.story_element_count,
        })
        
        print("\nPress Enter for next segment...")
        input()
    
    # Show final report
    print_final_report(results)
    
    # Save results
    results_path = os.path.join(os.path.dirname(__file__), "calibration_results.json")
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to: {results_path}")


def quick_test():
    """Quick non-interactive test to verify the tool works."""
    print("Running quick verification...")
    
    for seg in SAMPLE_SEGMENTS[:3]:
        unit = _heuristic_narrative_detection(
            clip_id=seg["id"],
            start_time=seg["start"],
            end_time=seg["end"],
            transcript=seg["transcript"],
        )
        report = apply_narrative_gate(unit)
        
        verdict = "PASS" if unit.is_shippable else "DROP"
        print(f"{seg['id']}: {verdict} (conf={unit.confidence:.0%}, elements={unit.story_element_count})")
    
    print("\n✅ Tool is working. Run with --calibrate for interactive mode.")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="ClipBot Human Calibration Tool")
    parser.add_argument("--calibrate", action="store_true", help="Run interactive calibration")
    parser.add_argument("--quick", action="store_true", help="Quick verification test")
    parser.add_argument("--file", type=str, help="Load segments from JSON file")
    
    args = parser.parse_args()
    
    if args.quick:
        quick_test()
    elif args.calibrate:
        segments = None
        if args.file:
            segments = load_segments_from_file(args.file)
        run_calibration(segments)
    else:
        print("ClipBot Human Calibration Tool")
        print("=" * 40)
        print("\nUsage:")
        print("  --quick       Quick verification test")
        print("  --calibrate   Interactive calibration (default samples)")
        print("  --file PATH   Load segments from JSON file")
        print("\nExample:")
        print("  python calibrate.py --calibrate")
        print("  python calibrate.py --calibrate --file my_segments.json")


if __name__ == "__main__":
    main()
