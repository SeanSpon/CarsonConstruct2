#!/usr/bin/env python3
"""
CLI script to delete a project by ID.

Usage:
    python delete_project.py <project_id>
"""
import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from storage.project_db import ProjectDatabase


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No project ID provided'}))
        sys.exit(1)
    
    project_id = sys.argv[1]
    
    # Get projects directory from environment or use default
    projects_dir = os.environ.get('PODFLOW_PROJECTS_DIR', './projects')
    
    try:
        db = ProjectDatabase(projects_dir)
        db.delete_project(project_id)
        
        print(json.dumps({'success': True, 'deleted': project_id}))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
