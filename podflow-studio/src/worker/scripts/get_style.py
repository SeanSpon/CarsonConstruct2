#!/usr/bin/env python3
"""
CLI script to get full style configuration by ID.

Usage:
    python get_style.py <style_id>
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.style_system import StyleSystem


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No style ID provided'}))
        sys.exit(1)
    
    style_id = sys.argv[1]
    
    try:
        style = StyleSystem.get_preset(style_id)
        print(json.dumps(style, indent=2))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
