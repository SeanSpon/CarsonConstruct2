#!/usr/bin/env python3
"""
CLI script to list all export format presets.

Usage:
    python list_export_formats.py
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from export.format_manager import FormatManager


def main():
    try:
        manager = FormatManager()
        formats = manager.list_formats()
        print(json.dumps(formats, indent=2))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
