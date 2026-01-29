#!/usr/bin/env python3
"""
Stage 0 validation - transcription + narrative detection work.

This script validates that the foundation components work:
1. TranscriptionService produces word-level timestamps
2. NarrativeDetector finds story-complete segments

Usage:
    python test_stage_0.py <video_path>
    python test_stage_0.py --mock  # Run with mock data (no video needed)
"""
import sys
import os
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def create_mock_transcript() -> dict:
    """Create a mock transcript for testing without a real video."""
    # Simulate a conversation with story-like segments
    mock_words = []
    current_time = 0.0
    
    stories = [
        # Story 1: Setup + Conflict + Payoff
        "So let me tell you about this crazy thing that happened. "
        "I was working on this project and everything was going great. "
        "But then suddenly the whole thing just crashed. "
        "I mean completely failed, nothing worked. "
        "Turns out there was a bug in the database connection. "
        "So I spent three hours debugging it. "
        "And finally I realized the problem was just a typo. "
        "That's why you should always double check your config files.",
        
        # Story 2: Setup + Conflict
        "Here's the thing about podcasting that nobody tells you. "
        "Everyone thinks it's just talking into a microphone. "
        "But actually it's way more complicated than that. "
        "The editing alone takes hours and hours. "
        "And don't even get me started on the technical issues.",
        
        # Story 3: Full narrative with engagement
        "Picture this. You're at a coffee shop working on your laptop. "
        "And this guy walks up and says he loves your work. "
        "I was honestly shocked because I had like ten followers. "
        "Turns out he was a major investor looking for startups. "
        "Long story short we ended up getting funded. "
        "That's literally how it happened. Mind blowing right? "
        "The lesson here is you never know who's watching.",
        
        # Non-story content (should score low)
        "Yeah I don't know. Maybe. Could be. I guess so.",
        
        # Story 4: Good setup and payoff
        "The question everyone asks me is how to get started. "
        "And I always tell them the same thing. "
        "Just start. Don't wait for perfect conditions. "
        "Because the truth is there's never a perfect time. "
        "Every successful person I know just started anyway. "
        "And that's the secret that nobody wants to hear. "
        "You have to be willing to fail first.",
    ]
    
    for story in stories:
        words = story.split()
        for word in words:
            word_duration = 0.3 + (len(word) * 0.02)  # Longer words take longer
            mock_words.append({
                'text': word,
                'start': current_time,
                'end': current_time + word_duration,
            })
            current_time += word_duration + 0.1  # Small gap between words
        
        # Gap between stories
        current_time += 2.0
    
    return {
        'text': ' '.join([w['text'] for w in mock_words]),
        'words': mock_words,
        'segments': [],
        'language': 'en',
    }


def test_transcription(video_path: str = None) -> dict:
    """Test the transcription service."""
    print("\n[1/2] Testing transcription service...")
    
    if video_path and os.path.exists(video_path):
        from services.transcription import TranscriptionService
        
        print(f"      Initializing Whisper model...")
        ts = TranscriptionService(model_size='tiny')  # Use tiny for fast testing
        
        print(f"      Transcribing: {video_path}")
        transcript = ts.transcribe_video(video_path)
        
        # Validate transcript structure
        assert 'words' in transcript, "Transcript missing 'words' field"
        assert 'text' in transcript, "Transcript missing 'text' field"
        assert len(transcript['words']) > 0, "No words in transcript"
        
        # Validate word structure
        for word in transcript['words'][:5]:
            assert 'text' in word, "Word missing 'text' field"
            assert 'start' in word, "Word missing 'start' timestamp"
            assert 'end' in word, "Word missing 'end' timestamp"
            assert word['end'] > word['start'], "Word end time must be > start time"
        
        print(f"      ✅ Transcribed {len(transcript['words'])} words")
        if transcript['words']:
            print(f"      ✅ Duration: {transcript['words'][-1]['end']:.1f}s")
        
        return transcript
    else:
        print("      ⚠️  No video provided, using mock transcript")
        transcript = create_mock_transcript()
        print(f"      ✅ Mock transcript has {len(transcript['words'])} words")
        return transcript


def test_narrative_detection(transcript: dict) -> list:
    """Test the narrative detector."""
    print("\n[2/2] Testing narrative detection...")
    
    from pipeline.narrative_detector import NarrativeDetector
    
    nd = NarrativeDetector()
    segments = nd.detect_story_segments(
        transcript,
        min_duration=5.0,   # Lower for testing (mock has shorter segments)
        max_duration=90.0,
        max_segments=10,
        min_words=20,
    )
    
    # Validate segments
    assert len(segments) > 0, "No segments detected"
    
    # Check that at least some segments have good story scores
    good_segments = [s for s in segments if s['story_score'] >= 40]
    assert len(good_segments) > 0, "No segments with score >= 40"
    
    # Validate segment structure
    for seg in segments:
        assert 'start_time' in seg, "Segment missing start_time"
        assert 'end_time' in seg, "Segment missing end_time"
        assert 'story_score' in seg, "Segment missing story_score"
        assert 'has_setup' in seg, "Segment missing has_setup"
        assert 'has_conflict' in seg, "Segment missing has_conflict"
        assert 'has_payoff' in seg, "Segment missing has_payoff"
        assert seg['end_time'] > seg['start_time'], "Invalid segment timing"
    
    print(f"      ✅ Found {len(segments)} story segments")
    print(f"      ✅ {len(good_segments)} segments with score >= 40")
    
    return segments


def print_results(segments: list) -> None:
    """Print detailed results."""
    print("\n" + "=" * 60)
    print("TOP SEGMENTS:")
    print("=" * 60)
    
    for i, seg in enumerate(segments[:5]):
        print(f"\n📖 Segment {i+1}:")
        print(f"   ⭐ Score: {seg['story_score']}/100")
        print(f"   ⏱️  Duration: {seg['duration']:.1f}s")
        print(f"   📝 Words: {seg['word_count']}")
        print(f"   ✓ Setup: {'✅' if seg['has_setup'] else '❌'}")
        print(f"   ⚡ Conflict: {'✅' if seg['has_conflict'] else '❌'}")
        print(f"   🎯 Payoff: {'✅' if seg['has_payoff'] else '❌'}")
        print(f"   💫 Engagement: {seg['engagement_score']}")
        
        # Show text preview (first 150 chars)
        text_preview = seg['text'][:150] + "..." if len(seg['text']) > 150 else seg['text']
        print(f"   📄 Text: {text_preview}")


def main():
    print("=" * 60)
    print("STAGE 0 TEST: Foundation")
    print("=" * 60)
    
    # Get video path from args
    video_path = None
    use_mock = False
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--mock':
            use_mock = True
        else:
            video_path = sys.argv[1]
            if not os.path.exists(video_path):
                print(f"❌ Video file not found: {video_path}")
                print("   Run with --mock to test with mock data")
                sys.exit(1)
    else:
        use_mock = True
        print("No video path provided, using mock data.")
        print("Usage: python test_stage_0.py <video_path>")
        print("       python test_stage_0.py --mock")
    
    try:
        # Test 1: Transcription
        transcript = test_transcription(video_path if not use_mock else None)
        
        # Test 2: Narrative Detection
        segments = test_narrative_detection(transcript)
        
        # Print detailed results
        print_results(segments)
        
        # Final summary
        print("\n" + "=" * 60)
        print("✅ STAGE 0 PASSED - Foundation works!")
        print("=" * 60)
        
        # Output JSON for further use
        output_file = 'stage0_results.json'
        with open(output_file, 'w') as f:
            json.dump({
                'transcript': transcript,
                'segments': segments,
            }, f, indent=2)
        print(f"\n📁 Results saved to: {output_file}")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
