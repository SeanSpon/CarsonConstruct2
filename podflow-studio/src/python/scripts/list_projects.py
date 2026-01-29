#!/usr/bin/env python3
"""
CLI script to list projects from the database.

Usage:
    python list_projects.py [status]
    
    status: Optional filter - 'all', 'processing', 'complete', 'error'
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from storage.project_db import ProjectDatabase


def main():
    # Parse arguments
    status = sys.argv[1] if len(sys.argv) > 1 else None
    if status == 'all':
        status = None
    
    # Get projects directory from environment or use default
    projects_dir = os.environ.get('PODFLOW_PROJECTS_DIR', './projects')
    
    try:
        db = ProjectDatabase(projects_dir)
        projects = db.list_projects(status=status)
        
        # Output as JSON
        print(json.dumps(projects, indent=2))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
