#!/usr/bin/env python3
"""
CLI script to get storage statistics.

Usage:
    python storage_stats.py
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from storage.project_db import ProjectDatabase


def main():
    # Get projects directory from environment or use default
    projects_dir = os.environ.get('PODFLOW_PROJECTS_DIR', './projects')
    
    try:
        db = ProjectDatabase(projects_dir)
        stats = db.get_storage_stats()
        
        print(json.dumps(stats, indent=2))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
