"""
Clip Enhancement with GPT-4o-mini

Enhances clips with:
- Quality validation (is this a complete thought?)
- Viral title generation
- Hook text for captions
- Category classification
- Quality score multiplier

Cost: ~$0.01 per clip
"""

import json
from typing import List, Dict, Optional
from .transcription import get_transcript_for_clip

def enhance_clips_with_ai(clips: List[Dict], transcript: Dict, api_key: str) -> List[Dict]:
    """
    Enhance each clip with AI-generated metadata.
    
    Args:
        clips: List of detected clips
        transcript: Full transcript from Whisper
        api_key: OpenAI API key
    
    Returns:
        Clips with AI enhancements
    """
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("openai package not installed. Run: pip install openai")
    
    client = OpenAI(api_key=api_key)
    enhanced_clips = []
    
    for clip in clips:
        try:
            # Get transcript segment for this clip
            clip_text = get_transcript_for_clip(
                transcript, 
                clip['startTime'], 
                clip['endTime']
            )
            
            if not clip_text or len(clip_text) < 10:
                # Skip AI enhancement if no transcript
                clip['transcript'] = clip_text
                clip['finalScore'] = clip.get('finalScore', clip.get('algorithmScore', 50))
                enhanced_clips.append(clip)
                continue
            
            # AI Enhancement Prompt
            prompt = f"""You are analyzing a podcast clip for viral potential.

Clip transcript ({clip['duration']:.0f}s):
"{clip_text[:1500]}"

Audio pattern detected: {clip['pattern']}
Algorithm score: {clip.get('algorithmScore', 50)}/100

Analyze this clip and return JSON with these fields:
1. isComplete (boolean): Is this a complete thought/idea?
2. startsClean (boolean): Doesn't start mid-sentence?
3. endsClean (boolean): Doesn't end abruptly mid-thought?
4. title (string): Viral hook title (8-12 words, engaging, NO clickbait lies)
5. hookText (string): Caption for first 3 seconds (5-8 words max, punchy)
6. category (string): One of: funny, insightful, controversial, story, educational, rant
7. sentiment (string): positive, negative, or neutral
8. qualityScore (float): 0.7-1.3 multiplier based on overall clip quality

Return ONLY valid JSON, no explanation or markdown."""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=400
            )
            
            # Parse response
            response_text = response.choices[0].message.content.strip()
            
            # Clean up response if needed
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
            
            ai_data = json.loads(response_text)
            
            # Merge AI data with clip
            enhanced_clip = {
                **clip,
                'transcript': clip_text[:500],  # Truncate for UI
                'isComplete': ai_data.get('isComplete', True),
                'startsClean': ai_data.get('startsClean', True),
                'endsClean': ai_data.get('endsClean', True),
                'title': ai_data.get('title', ''),
                'hookText': ai_data.get('hookText', ''),
                'category': ai_data.get('category', 'story'),
                'sentiment': ai_data.get('sentiment', 'neutral'),
                'aiQualityMultiplier': float(ai_data.get('qualityScore', 1.0)),
            }
            
            # Calculate final score
            base_score = clip.get('finalScore', clip.get('algorithmScore', 50))
            ai_multiplier = enhanced_clip['aiQualityMultiplier']
            enhanced_clip['finalScore'] = round(min(100, base_score * ai_multiplier), 1)
            
            enhanced_clips.append(enhanced_clip)
            
        except json.JSONDecodeError as e:
            # JSON parsing failed, keep original clip
            clip['transcript'] = clip_text if 'clip_text' in dir() else ''
            clip['finalScore'] = clip.get('finalScore', clip.get('algorithmScore', 50))
            enhanced_clips.append(clip)
        except Exception as e:
            # Any other error, keep original clip
            clip['finalScore'] = clip.get('finalScore', clip.get('algorithmScore', 50))
            enhanced_clips.append(clip)
    
    return enhanced_clips


def generate_batch_titles(clips: List[Dict], transcript: Dict, api_key: str) -> List[Dict]:
    """
    Generate titles for multiple clips in a single API call (more efficient).
    
    This is an alternative to enhance_clips_with_ai that batches requests.
    Use for large clip counts to reduce API calls.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return clips
    
    client = OpenAI(api_key=api_key)
    
    # Prepare batch prompt
    clip_summaries = []
    for i, clip in enumerate(clips[:15]):  # Limit to 15 clips per batch
        clip_text = get_transcript_for_clip(
            transcript,
            clip['startTime'],
            clip['endTime']
        )
        if clip_text:
            clip_summaries.append(f"Clip {i+1} ({clip['duration']:.0f}s, {clip['pattern']}): \"{clip_text[:200]}...\"")
    
    if not clip_summaries:
        return clips
    
    prompt = f"""Generate viral titles for these podcast clips.

{chr(10).join(clip_summaries)}

For each clip, return a JSON array with objects containing:
- clipIndex (int): 1-based index
- title (string): Engaging 8-12 word title
- hookText (string): 5-8 word caption hook
- category (string): funny/insightful/controversial/story/educational/rant

Return ONLY valid JSON array, no explanation."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1000
        )
        
        response_text = response.choices[0].message.content.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        
        titles_data = json.loads(response_text)
        
        # Merge titles into clips
        for item in titles_data:
            idx = item.get('clipIndex', 0) - 1
            if 0 <= idx < len(clips):
                clips[idx]['title'] = item.get('title', '')
                clips[idx]['hookText'] = item.get('hookText', '')
                clips[idx]['category'] = item.get('category', 'story')
        
    except Exception:
        pass  # Keep original clips on error
    
    return clips
