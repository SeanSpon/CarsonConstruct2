#!/usr/bin/env python3
"""
CLI script to list all style presets.

Usage:
    python list_styles.py
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.style_system import StyleSystem


def main():
    try:
        presets = StyleSystem.list_presets()
        print(json.dumps(presets, indent=2))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
