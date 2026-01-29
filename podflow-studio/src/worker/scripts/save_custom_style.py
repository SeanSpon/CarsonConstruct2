#!/usr/bin/env python3
"""
CLI script to save a custom style to disk.

Usage:
    python save_custom_style.py '<json_style_data>'
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No style data provided'}))
        sys.exit(1)
    
    try:
        style_data = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON: {str(e)}'}))
        sys.exit(1)
    
    # Save to custom styles directory
    custom_dir = os.environ.get('PODFLOW_CUSTOM_STYLES_DIR', './custom_styles')
    os.makedirs(custom_dir, exist_ok=True)
    
    try:
        style_id = style_data.get('id', 'custom_style')
        filepath = os.path.join(custom_dir, f"{style_id}.json")
        
        with open(filepath, 'w') as f:
            json.dump(style_data, f, indent=2)
        
        print(json.dumps({
            'success': True,
            'filepath': filepath,
            'style_id': style_id
        }))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
