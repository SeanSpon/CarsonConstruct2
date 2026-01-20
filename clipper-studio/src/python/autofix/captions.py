"""
Caption auto-fixer for Clipper Studio.

Fixes caption issues:
- Overlapping subtitle ranges (trim/shift)
- Too many words per line (split)
- Missing highlight word (remove highlight)
- Captions outside clip bounds (clamp/remove)

IMPORTANT: Fixes are mechanical, not content-altering.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class CaptionFixResult:
    """Result of a caption fix operation."""
    success: bool
    captions: List[Dict]
    fixes_applied: List[str]
    removed_count: int


class CaptionFixer:
    """Fixes caption issues through deterministic adjustments."""
    
    def __init__(
        self,
        max_words_per_line: int = 6,
        min_gap: float = 0.05,  # Minimum gap between captions in seconds
    ):
        self.max_words_per_line = max_words_per_line
        self.min_gap = min_gap
    
    def fix(
        self,
        captions: List[Dict],
        errors: List[Dict],
        clip_start: Optional[float] = None,
        clip_end: Optional[float] = None,
    ) -> CaptionFixResult:
        """
        Attempt to fix caption issues.
        
        Args:
            captions: List of caption objects
            errors: List of validation errors
            clip_start: Clip start time for bounds clamping
            clip_end: Clip end time for bounds clamping
        
        Returns:
            CaptionFixResult with fixed captions
        """
        if not captions:
            return CaptionFixResult(
                success=True,
                captions=[],
                fixes_applied=[],
                removed_count=0,
            )
        
        # Make a copy to avoid mutating original
        fixed_captions = [dict(c) for c in captions]
        fixes_applied = []
        removed_indices = set()
        
        # Process each error
        for error in errors:
            code = error.get('code', '') if isinstance(error, dict) else error.code
            details = error.get('details', {}) if isinstance(error, dict) else error.details
            
            if code == "CAPTION_OVERLAP":
                result = self._fix_overlap(fixed_captions, details)
                if result:
                    fixed_captions, fix_msg = result
                    fixes_applied.append(fix_msg)
            
            elif code == "CAPTION_TOO_MANY_WORDS":
                idx = details.get('caption_index')
                if idx is not None and idx < len(fixed_captions):
                    result = self._fix_too_many_words(fixed_captions[idx])
                    if result:
                        fixed_captions[idx] = result
                        fixes_applied.append(f"split_caption_{idx}")
            
            elif code == "CAPTION_HIGHLIGHT_MISSING":
                idx = details.get('caption_index')
                if idx is not None and idx < len(fixed_captions):
                    # Remove the highlight
                    fixed_captions[idx].pop('highlight', None)
                    fixed_captions[idx].pop('highlightWord', None)
                    fixes_applied.append(f"removed_highlight_caption_{idx}")
            
            elif code == "CAPTION_BEFORE_CLIP":
                idx = details.get('caption_index')
                if idx is not None and clip_start is not None:
                    result = self._fix_before_clip(fixed_captions[idx], clip_start)
                    if result is None:
                        removed_indices.add(idx)
                        fixes_applied.append(f"removed_caption_{idx}_before_clip")
                    else:
                        fixed_captions[idx] = result
                        fixes_applied.append(f"clamped_caption_{idx}_start")
            
            elif code == "CAPTION_AFTER_CLIP":
                idx = details.get('caption_index')
                if idx is not None and clip_end is not None:
                    result = self._fix_after_clip(fixed_captions[idx], clip_end)
                    if result is None:
                        removed_indices.add(idx)
                        fixes_applied.append(f"removed_caption_{idx}_after_clip")
                    else:
                        fixed_captions[idx] = result
                        fixes_applied.append(f"clamped_caption_{idx}_end")
        
        # Remove marked captions
        if removed_indices:
            fixed_captions = [
                c for i, c in enumerate(fixed_captions)
                if i not in removed_indices
            ]
        
        # Sort by start time
        fixed_captions.sort(
            key=lambda c: c.get('start', c.get('startTime', 0))
        )
        
        return CaptionFixResult(
            success=True,
            captions=fixed_captions,
            fixes_applied=fixes_applied,
            removed_count=len(removed_indices),
        )
    
    def rebuild_captions(
        self,
        transcript_words: List[Dict],
        clip_start: float,
        clip_end: float,
    ) -> List[Dict]:
        """
        Rebuild captions from transcript for a clip region.
        
        This is a last-resort fix when captions are too broken to repair.
        
        Args:
            transcript_words: Full transcript word list
            clip_start: Clip start time
            clip_end: Clip end time
        
        Returns:
            New caption list built from transcript
        """
        # Filter words in clip range
        clip_words = []
        for word in transcript_words:
            word_start = word.get('start', word.get('startTime', 0))
            word_end = word.get('end', word.get('endTime', 0))
            
            # Word must be at least partially in clip
            if word_end > clip_start and word_start < clip_end:
                clip_words.append(word)
        
        if not clip_words:
            return []
        
        # Group words into caption groups
        captions = []
        current_group = []
        
        for word in clip_words:
            current_group.append(word)
            
            # Start new group if we have enough words
            if len(current_group) >= self.max_words_per_line:
                captions.append(self._create_caption_from_words(current_group))
                current_group = []
        
        # Handle remaining words
        if current_group:
            captions.append(self._create_caption_from_words(current_group))
        
        return captions
    
    def _create_caption_from_words(self, words: List[Dict]) -> Dict:
        """Create a caption object from a list of words."""
        if not words:
            return {}
        
        start = words[0].get('start', words[0].get('startTime', 0))
        end = words[-1].get('end', words[-1].get('endTime', 0))
        text = ' '.join(
            w.get('word', w.get('text', '')) for w in words
        )
        
        return {
            'start': round(start, 3),
            'end': round(end, 3),
            'startTime': round(start, 3),
            'endTime': round(end, 3),
            'text': text.strip(),
            'words': words,
        }
    
    def _fix_overlap(
        self,
        captions: List[Dict],
        details: Dict,
    ) -> Optional[tuple]:
        """Fix overlapping captions by trimming the earlier one."""
        idx = details.get('caption_index', 0)
        next_idx = details.get('next_caption_index', idx + 1)
        
        if idx >= len(captions) or next_idx >= len(captions):
            return None
        
        current = captions[idx]
        next_cap = captions[next_idx]
        
        current_end = current.get('end', current.get('endTime', 0))
        next_start = next_cap.get('start', next_cap.get('startTime', 0))
        
        if current_end > next_start:
            # Trim current caption to end before next starts
            new_end = next_start - self.min_gap
            current['end'] = round(new_end, 3)
            current['endTime'] = round(new_end, 3)
            
            return (captions, f"trimmed_caption_{idx}_end_for_overlap")
        
        return None
    
    def _fix_too_many_words(self, caption: Dict) -> Optional[Dict]:
        """Fix caption with too many words by truncating."""
        text = caption.get('text', caption.get('word', ''))
        words = text.strip().split()
        
        if len(words) <= self.max_words_per_line:
            return None
        
        # Truncate to max words
        truncated_words = words[:self.max_words_per_line]
        caption['text'] = ' '.join(truncated_words)
        
        # If we have word-level timing, also truncate that
        if 'words' in caption and len(caption['words']) > self.max_words_per_line:
            caption['words'] = caption['words'][:self.max_words_per_line]
            # Update end time to last word's end
            if caption['words']:
                last_word = caption['words'][-1]
                new_end = last_word.get('end', last_word.get('endTime', caption.get('end', 0)))
                caption['end'] = round(new_end, 3)
                caption['endTime'] = round(new_end, 3)
        
        return caption
    
    def _fix_before_clip(
        self,
        caption: Dict,
        clip_start: float,
    ) -> Optional[Dict]:
        """Fix caption that starts before clip by clamping or removing."""
        cap_start = caption.get('start', caption.get('startTime', 0))
        cap_end = caption.get('end', caption.get('endTime', 0))
        
        # If caption ends before clip, remove it entirely
        if cap_end <= clip_start:
            return None
        
        # Clamp start to clip start
        caption['start'] = round(clip_start, 3)
        caption['startTime'] = round(clip_start, 3)
        
        return caption
    
    def _fix_after_clip(
        self,
        caption: Dict,
        clip_end: float,
    ) -> Optional[Dict]:
        """Fix caption that ends after clip by clamping or removing."""
        cap_start = caption.get('start', caption.get('startTime', 0))
        cap_end = caption.get('end', caption.get('endTime', 0))
        
        # If caption starts after clip, remove it entirely
        if cap_start >= clip_end:
            return None
        
        # Clamp end to clip end
        caption['end'] = round(clip_end, 3)
        caption['endTime'] = round(clip_end, 3)
        
        return caption


def remove_first_caption(captions: List[Dict]) -> List[Dict]:
    """Remove the first caption from a list."""
    if not captions:
        return []
    return captions[1:]


def remove_last_caption(captions: List[Dict]) -> List[Dict]:
    """Remove the last caption from a list."""
    if not captions:
        return []
    return captions[:-1]
