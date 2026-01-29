"""
Manage b-roll library and match clips to keywords.

This module organizes b-roll footage and provides intelligent
matching based on keyword categories.
"""
import os
import json
import random
from typing import List, Dict, Optional, Any


class BrollLibrary:
    """
    Manages a library of b-roll video clips.
    
    B-roll clips should be organized with descriptive filenames:
    - category_description_001.mp4 (e.g., tech_coding_001.mp4)
    - Or placed in category folders
    
    The library builds an index for fast lookup and matching.
    """
    
    # Default categories for b-roll organization
    DEFAULT_CATEGORIES = [
        'tech', 'business', 'science', 'nature', 'people', 
        'action', 'abstract', 'data', 'generic'
    ]
    
    def __init__(self, library_path: str):
        """
        Initialize b-roll library.
        
        Args:
            library_path: Path to folder containing b-roll clips
        """
        self.library_path = library_path
        self.index = self._build_index()
    
    def _build_index(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Build a searchable index of b-roll files.
        
        Returns:
            Dictionary mapping categories to lists of clip info
        """
        index = {cat: [] for cat in self.DEFAULT_CATEGORIES}
        
        if not os.path.exists(self.library_path):
            return index
        
        # Check for index.json cache
        cache_file = os.path.join(self.library_path, 'broll_index.json')
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    cached_index = json.load(f)
                # Verify files still exist
                if self._verify_index(cached_index):
                    return cached_index
            except (json.JSONDecodeError, IOError):
                pass
        
        # Scan library folder
        self._scan_directory(self.library_path, index)
        
        # Check subdirectories for category folders
        for item in os.listdir(self.library_path):
            item_path = os.path.join(self.library_path, item)
            if os.path.isdir(item_path) and item.lower() in self.DEFAULT_CATEGORIES:
                self._scan_directory(item_path, index, default_category=item.lower())
        
        # Save index cache
        try:
            with open(cache_file, 'w') as f:
                json.dump(index, f, indent=2)
        except IOError:
            pass
        
        return index
    
    def _scan_directory(
        self,
        directory: str,
        index: Dict[str, List],
        default_category: str = 'generic'
    ):
        """
        Scan a directory for video files and add to index.
        
        Args:
            directory: Directory to scan
            index: Index dictionary to update
            default_category: Default category for untagged files
        """
        video_extensions = ('.mp4', '.mov', '.avi', '.mkv', '.webm')
        
        for filename in os.listdir(directory):
            if not filename.lower().endswith(video_extensions):
                continue
            
            filepath = os.path.join(directory, filename)
            
            # Parse filename for category info
            # Expected format: category_description_001.mp4
            name_parts = filename.lower().replace(
                os.path.splitext(filename)[1], ''
            ).split('_')
            
            category = default_category
            tags = []
            
            if len(name_parts) >= 2:
                potential_category = name_parts[0]
                if potential_category in self.DEFAULT_CATEGORIES:
                    category = potential_category
                    tags = name_parts[1:]
                else:
                    tags = name_parts
            else:
                tags = name_parts
            
            clip_info = {
                'path': filepath,
                'filename': filename,
                'tags': [t for t in tags if t and not t.isdigit()],
                'category': category
            }
            
            # Add to appropriate category
            if category in index:
                index[category].append(clip_info)
            else:
                index['generic'].append(clip_info)
    
    def _verify_index(self, cached_index: Dict) -> bool:
        """
        Verify that cached index files still exist.
        
        Args:
            cached_index: Previously cached index
        
        Returns:
            True if all files exist, False otherwise
        """
        for category, clips in cached_index.items():
            for clip in clips:
                if not os.path.exists(clip.get('path', '')):
                    return False
        return True
    
    def find_broll(
        self,
        keyword: Dict[str, Any],
        used_clips: List[str] = None
    ) -> Optional[str]:
        """
        Find the best matching b-roll clip for a keyword.
        
        Args:
            keyword: Keyword dict from KeywordExtractor
            used_clips: List of already-used clip paths to avoid repeats
        
        Returns:
            Path to b-roll clip or None if not found
        """
        used_clips = used_clips or []
        category = keyword.get('category', 'generic')
        
        # Try exact category first
        if category in self.index and self.index[category]:
            available = [
                c for c in self.index[category]
                if c['path'] not in used_clips
            ]
            
            if available:
                # Prefer clips with matching tags
                keyword_text = keyword.get('keyword', '').lower()
                tagged_matches = [
                    c for c in available
                    if any(keyword_text in t for t in c.get('tags', []))
                ]
                
                if tagged_matches:
                    return random.choice(tagged_matches)['path']
                
                return random.choice(available)['path']
        
        # Fall back to generic
        if self.index.get('generic'):
            available = [
                c for c in self.index['generic']
                if c['path'] not in used_clips
            ]
            if available:
                return random.choice(available)['path']
        
        return None
    
    def find_multiple_broll(
        self,
        keywords: List[Dict[str, Any]],
        max_clips: int = None
    ) -> Dict[float, str]:
        """
        Find b-roll clips for multiple keywords.
        
        Args:
            keywords: List of keyword dicts
            max_clips: Maximum number of clips to return
        
        Returns:
            Dictionary mapping timestamps to b-roll paths
        """
        used_clips = []
        broll_map = {}
        
        keywords_to_process = keywords
        if max_clips:
            keywords_to_process = keywords[:max_clips]
        
        for keyword in keywords_to_process:
            clip_path = self.find_broll(keyword, used_clips)
            
            if clip_path:
                timestamp = keyword.get('timestamp', 0)
                broll_map[timestamp] = clip_path
                used_clips.append(clip_path)
        
        return broll_map
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get library statistics.
        
        Returns:
            Dictionary with clip counts by category
        """
        total = sum(len(clips) for clips in self.index.values())
        
        return {
            'total_clips': total,
            'by_category': {
                cat: len(clips)
                for cat, clips in self.index.items()
                if clips
            },
            'library_path': self.library_path,
            'categories_available': [
                cat for cat, clips in self.index.items()
                if clips
            ]
        }
    
    def add_clip(
        self,
        filepath: str,
        category: str,
        tags: List[str] = None
    ):
        """
        Add a clip to the library.
        
        Args:
            filepath: Path to video file
            category: Category to add clip to
            tags: Optional list of tags
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Clip not found: {filepath}")
        
        if category not in self.index:
            category = 'generic'
        
        clip_info = {
            'path': filepath,
            'filename': os.path.basename(filepath),
            'tags': tags or [],
            'category': category
        }
        
        # Check for duplicates
        existing_paths = [c['path'] for c in self.index[category]]
        if filepath not in existing_paths:
            self.index[category].append(clip_info)
    
    def refresh_index(self):
        """Rebuild the index from scratch."""
        # Clear cache file
        cache_file = os.path.join(self.library_path, 'broll_index.json')
        if os.path.exists(cache_file):
            os.remove(cache_file)
        
        # Rebuild
        self.index = self._build_index()
