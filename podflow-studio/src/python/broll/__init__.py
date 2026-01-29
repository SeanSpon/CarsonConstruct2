"""
B-roll management module for PodFlow Studio
"""
from .keyword_extractor import KeywordExtractor
from .library_manager import BrollLibrary
from .compositor import BrollCompositor

__all__ = ['KeywordExtractor', 'BrollLibrary', 'BrollCompositor']
