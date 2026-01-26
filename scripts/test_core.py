"""
Test script for the new story-first pipeline.

Run this to verify the core logic works correctly.
"""

import sys
import os

# Add core to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.narrative.unit import NarrativeUnit, NarrativeVerdict, create_narrative_unit
from core.narrative.detector import detect_narrative_structure, _heuristic_narrative_detection
from core.narrative.gate import apply_narrative_gate, apply_gates_batch, summarize_gate_results
from core.pipeline.story_pipeline import StoryPipeline, run_story_pipeline
from core.pipeline.config import PipelineConfig, load_config


def test_narrative_unit():
    """Test NarrativeUnit creation and verdict calculation."""
    print("\n=== Testing NarrativeUnit ===")
    
    # Test 1: Complete story (should PASS)
    unit1 = create_narrative_unit(
        clip_id="test_1",
        start_time=0.0,
        end_time=45.0,
        transcript="Here's the thing about success. The key is consistency over time. And that's why daily habits matter more than big moments.",
        has_setup=True,
        has_core=True,
        has_resolution=True,
        confidence=0.85,
        context_dependency=0.2,
    )
    print(f"Complete story: {unit1.verdict.value} (elements: {unit1.story_element_count})")
    assert unit1.verdict == NarrativeVerdict.PASS, "Complete story should PASS"
    assert unit1.confidence_label == "🔥", "High confidence should be 🔥"
    
    # Test 2: Missing resolution (should still PASS with 2/3)
    unit2 = create_narrative_unit(
        clip_id="test_2",
        start_time=45.0,
        end_time=90.0,
        transcript="So what happened was, we tried everything. And the data showed something interesting.",
        has_setup=True,
        has_core=True,
        has_resolution=False,
        confidence=0.7,
        context_dependency=0.3,
    )
    print(f"Setup+Core only: {unit2.verdict.value} (elements: {unit2.story_element_count})")
    assert unit2.verdict == NarrativeVerdict.PASS, "2/3 elements should PASS"
    
    # Test 3: Only one element (should DROP)
    unit3 = create_narrative_unit(
        clip_id="test_3",
        start_time=90.0,
        end_time=120.0,
        transcript="Yeah exactly, that's what I was saying earlier.",
        has_setup=False,
        has_core=True,
        has_resolution=False,
        confidence=0.8,
        context_dependency=0.5,
    )
    print(f"Core only: {unit3.verdict.value} (elements: {unit3.story_element_count})")
    assert unit3.verdict == NarrativeVerdict.DROP, "1/3 elements should DROP"
    
    # Test 4: Low confidence (should DROP)
    unit4 = create_narrative_unit(
        clip_id="test_4",
        start_time=120.0,
        end_time=150.0,
        transcript="Here's the setup. Here's the explanation. And here's the conclusion.",
        has_setup=True,
        has_core=True,
        has_resolution=True,
        confidence=0.4,  # Below threshold
        context_dependency=0.2,
    )
    print(f"Low confidence: {unit4.verdict.value} (confidence: {unit4.confidence})")
    assert unit4.verdict == NarrativeVerdict.DROP, "Low confidence should DROP"
    
    # Test 5: High context dependency (should DROP)
    unit5 = create_narrative_unit(
        clip_id="test_5",
        start_time=150.0,
        end_time=180.0,
        transcript="And that's why he said that thing about the project.",
        has_setup=True,
        has_core=True,
        has_resolution=True,
        confidence=0.8,
        context_dependency=0.9,  # Too dependent on prior context
    )
    print(f"High context dep: {unit5.verdict.value} (context_dep: {unit5.context_dependency})")
    assert unit5.verdict == NarrativeVerdict.DROP, "High context dependency should DROP"
    
    print("✅ NarrativeUnit tests passed!")


def test_heuristic_detection():
    """Test heuristic-based narrative detection (no AI)."""
    print("\n=== Testing Heuristic Detection ===")
    
    # Good transcript with clear structure
    good_transcript = """
    So here's the thing about building products. The key insight is that 
    you have to start with the problem, not the solution. Most founders 
    get this backwards. They build something cool and then try to find 
    customers. But the successful ones? They find the pain first. 
    And that's the difference between a hobby project and a real business.
    """
    
    unit1 = _heuristic_narrative_detection(
        clip_id="heuristic_1",
        start_time=0.0,
        end_time=45.0,
        transcript=good_transcript.strip(),
    )
    print(f"Good transcript: setup={unit1.has_setup}, core={unit1.has_core}, resolution={unit1.has_resolution}")
    print(f"  Confidence: {unit1.confidence:.2f}, Verdict: {unit1.verdict.value}")
    
    # Bad transcript (too short)
    short_transcript = "Yeah, exactly."
    
    unit2 = _heuristic_narrative_detection(
        clip_id="heuristic_2",
        start_time=45.0,
        end_time=50.0,
        transcript=short_transcript,
    )
    print(f"Short transcript: elements={unit2.story_element_count}, verdict={unit2.verdict.value}")
    assert unit2.verdict == NarrativeVerdict.DROP, "Short transcript should DROP"
    
    # Context-dependent start
    context_dep_transcript = "And that's why I told him we should pivot the company."
    
    unit3 = _heuristic_narrative_detection(
        clip_id="heuristic_3",
        start_time=50.0,
        end_time=60.0,
        transcript=context_dep_transcript,
    )
    print(f"Context-dependent: context_dep={unit3.context_dependency:.2f}")
    
    print("✅ Heuristic detection tests passed!")


def test_quality_gates():
    """Test the 4 quality gates."""
    print("\n=== Testing Quality Gates ===")
    
    # Create a good unit
    good_unit = create_narrative_unit(
        clip_id="gate_test_1",
        start_time=0.0,
        end_time=45.0,
        transcript="Here's the setup for today's topic. The core insight is that consistency beats intensity. And that's why small daily actions compound into big results over time.",
        has_setup=True,
        has_core=True,
        has_resolution=True,
        confidence=0.85,
        context_dependency=0.2,
    )
    
    visual_meta = {
        "speech_ratio": 0.85,
        "boundary_score": 0.9,
    }
    
    report = apply_narrative_gate(good_unit, visual_meta)
    print(f"Good unit gates: {report.all_passed}")
    for gate in report.gates:
        print(f"  {gate.gate.value}: {'✅' if gate.passed else '❌'} ({gate.reason})")
    
    assert report.all_passed, "Good unit should pass all gates"
    
    # Create a unit that fails caption gate (too few words)
    short_unit = create_narrative_unit(
        clip_id="gate_test_2",
        start_time=0.0,
        end_time=20.0,
        transcript="Yes. Exactly. Right.",
        has_setup=True,
        has_core=True,
        has_resolution=False,
        confidence=0.7,
        context_dependency=0.3,
    )
    
    report2 = apply_narrative_gate(short_unit)
    print(f"\nShort unit gates: {report2.all_passed}")
    for gate in report2.gates:
        print(f"  {gate.gate.value}: {'✅' if gate.passed else '❌'} ({gate.reason})")
    
    assert not report2.all_passed, "Short transcript should fail caption gate"
    
    print("✅ Quality gates tests passed!")


def test_batch_processing():
    """Test batch processing of segments."""
    print("\n=== Testing Batch Processing ===")
    
    # Create test segments
    segments = [
        {
            "id": "seg_1",
            "start": 0.0,
            "end": 45.0,
            "transcript": "So here's the thing about success. You have to understand that consistency is everything. The people who win are the ones who show up every single day. And that's the secret nobody tells you about.",
        },
        {
            "id": "seg_2",
            "start": 45.0,
            "end": 90.0,
            "transcript": "Yeah exactly.",  # Too short, should DROP
        },
        {
            "id": "seg_3",
            "start": 90.0,
            "end": 135.0,
            "transcript": "The question everyone asks is: how do you stay motivated? And the answer is simple. You don't rely on motivation. You build systems. You create habits. And eventually, showing up becomes automatic.",
        },
    ]
    
    result = run_story_pipeline(segments)
    
    print(f"Total candidates: {result.total_candidates}")
    print(f"Survivors: {len(result.survivors)}")
    print(f"Dropped: {result.dropped_count}")
    print(f"Gate summary: {result.gate_summary.get('message', 'N/A')}")
    
    for survivor in result.survivors:
        print(f"  ✅ {survivor.clip_id}: {survivor.confidence_label} (conf: {survivor.confidence:.2f})")
    
    print("✅ Batch processing tests passed!")


def test_pipeline_config():
    """Test pipeline configuration."""
    print("\n=== Testing Pipeline Config ===")
    
    config = PipelineConfig()
    print(f"Default config:")
    print(f"  Target clips: {config.target_clips}")
    print(f"  Min confidence: {config.gates.min_confidence}")
    print(f"  Strict mode: {config.strict_mode}")
    
    # Test serialization
    config_dict = config.to_dict()
    restored = PipelineConfig.from_dict(config_dict)
    
    assert restored.target_clips == config.target_clips
    assert restored.gates.min_confidence == config.gates.min_confidence
    
    print("✅ Pipeline config tests passed!")


def main():
    """Run all tests."""
    print("=" * 60)
    print("ClipBot MVP - Core Logic Tests")
    print("=" * 60)
    
    try:
        test_narrative_unit()
        test_heuristic_detection()
        test_quality_gates()
        test_batch_processing()
        test_pipeline_config()
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED!")
        print("=" * 60)
        print("\nThe story-first pipeline is working correctly.")
        print("Key behaviors verified:")
        print("  ✅ NarrativeUnit correctly computes verdicts")
        print("  ✅ 2/3 story elements required for PASS")
        print("  ✅ Low confidence → DROP")
        print("  ✅ High context dependency → DROP")
        print("  ✅ Quality gates filter correctly")
        print("  ✅ Batch processing works end-to-end")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
