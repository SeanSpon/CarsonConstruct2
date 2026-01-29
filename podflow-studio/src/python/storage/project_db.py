"""
Simple JSON-based project database for PodFlow Studio
"""
import json
import os
import shutil
from datetime import datetime
from typing import List, Dict, Optional


class ProjectDatabase:
    """
    JSON-based project database for storing and managing clip projects.
    
    Projects are stored in a directory structure:
    projects/
      index.json           # Quick lookup index
      {project_id}/
        project.json       # Full project data
        clips/             # Generated clip files
    """
    
    def __init__(self, projects_dir: str = './projects'):
        """
        Initialize project database.
        
        Args:
            projects_dir: Base directory for all projects
        """
        self.projects_dir = projects_dir
        self.index_file = os.path.join(projects_dir, 'index.json')
        
        os.makedirs(projects_dir, exist_ok=True)
        
        # Load or create index
        self.index = self._load_index()
    
    def _load_index(self) -> Dict:
        """Load project index from disk"""
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {'projects': []}
        return {'projects': []}
    
    def _save_index(self):
        """Save project index to disk"""
        with open(self.index_file, 'w') as f:
            json.dump(self.index, f, indent=2)
    
    def create_project(
        self,
        source_video: str,
        config: Dict
    ) -> str:
        """
        Create a new project.
        
        Args:
            source_video: Path to source video file
            config: Pipeline configuration used
        
        Returns:
            project_id: Unique identifier for the project
        """
        project_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        project_dir = os.path.join(self.projects_dir, project_id)
        
        os.makedirs(project_dir, exist_ok=True)
        
        # Create project metadata
        project_data = {
            'id': project_id,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'source_video': source_video,
            'source_video_name': os.path.basename(source_video),
            'config': config,
            'status': 'processing',
            'clips': [],
            'errors': [],
            'total_clips': 0
        }
        
        # Save project file
        project_file = os.path.join(project_dir, 'project.json')
        with open(project_file, 'w') as f:
            json.dump(project_data, f, indent=2)
        
        # Update index
        self.index['projects'].append({
            'id': project_id,
            'created_at': project_data['created_at'],
            'source_video_name': project_data['source_video_name'],
            'status': 'processing'
        })
        self._save_index()
        
        return project_id
    
    def update_project(
        self,
        project_id: str,
        updates: Dict
    ):
        """
        Update project data.
        
        Args:
            project_id: Project to update
            updates: Dictionary of fields to update
        """
        project_dir = os.path.join(self.projects_dir, project_id)
        project_file = os.path.join(project_dir, 'project.json')
        
        if not os.path.exists(project_file):
            raise ValueError(f"Project {project_id} not found")
        
        # Load current data
        with open(project_file, 'r') as f:
            project_data = json.load(f)
        
        # Update fields
        project_data.update(updates)
        project_data['updated_at'] = datetime.now().isoformat()
        
        # Save back
        with open(project_file, 'w') as f:
            json.dump(project_data, f, indent=2)
        
        # Update index status if changed
        for p in self.index['projects']:
            if p['id'] == project_id:
                if 'status' in updates:
                    p['status'] = updates['status']
                break
        self._save_index()
    
    def add_clip(
        self,
        project_id: str,
        clip_path: str,
        clip_metadata: Dict
    ):
        """
        Add a generated clip to a project.
        
        Args:
            project_id: Project to add clip to
            clip_path: Path to the clip file
            clip_metadata: Clip metadata (duration, score, etc.)
        """
        project_dir = os.path.join(self.projects_dir, project_id)
        clips_dir = os.path.join(project_dir, 'clips')
        
        os.makedirs(clips_dir, exist_ok=True)
        
        # Copy clip to project directory
        clip_name = os.path.basename(clip_path)
        dest_path = os.path.join(clips_dir, clip_name)
        
        if clip_path != dest_path and os.path.exists(clip_path):
            shutil.copy(clip_path, dest_path)
        
        # Update project file
        project_file = os.path.join(project_dir, 'project.json')
        with open(project_file, 'r') as f:
            project_data = json.load(f)
        
        clip_entry = {
            'filename': clip_name,
            'path': dest_path,
            'metadata': clip_metadata,
            'added_at': datetime.now().isoformat()
        }
        
        project_data['clips'].append(clip_entry)
        project_data['updated_at'] = datetime.now().isoformat()
        
        with open(project_file, 'w') as f:
            json.dump(project_data, f, indent=2)
    
    def get_project(self, project_id: str) -> Optional[Dict]:
        """
        Load a project by ID.
        
        Args:
            project_id: Project to load
        
        Returns:
            Project data or None if not found
        """
        project_file = os.path.join(
            self.projects_dir,
            project_id,
            'project.json'
        )
        
        if not os.path.exists(project_file):
            return None
        
        try:
            with open(project_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    
    def list_projects(
        self,
        limit: int = 50,
        status: str = None
    ) -> List[Dict]:
        """
        List all projects.
        
        Args:
            limit: Maximum number of projects to return
            status: Filter by status ('processing', 'complete', 'error')
        
        Returns:
            List of project data dictionaries
        """
        projects = self.index['projects'].copy()
        
        # Filter by status if specified
        if status:
            projects = [p for p in projects if p.get('status') == status]
        
        # Sort by created date (newest first)
        projects.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Limit results
        projects = projects[:limit]
        
        # Load full data for each project
        full_projects = []
        for p in projects:
            full_data = self.get_project(p['id'])
            if full_data:
                full_projects.append(full_data)
        
        return full_projects
    
    def delete_project(self, project_id: str):
        """
        Delete a project and all its files.
        
        Args:
            project_id: Project to delete
        """
        project_dir = os.path.join(self.projects_dir, project_id)
        
        # Remove directory and all contents
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)
        
        # Remove from index
        self.index['projects'] = [
            p for p in self.index['projects']
            if p['id'] != project_id
        ]
        self._save_index()
    
    def get_storage_stats(self) -> Dict:
        """
        Get storage statistics for all projects.
        
        Returns:
            Dictionary with total_projects, total_clips, total_size_mb, etc.
        """
        total_size = 0
        total_clips = 0
        
        for project in self.index['projects']:
            project_dir = os.path.join(self.projects_dir, project['id'])
            
            if os.path.exists(project_dir):
                for root, dirs, files in os.walk(project_dir):
                    for file in files:
                        filepath = os.path.join(root, file)
                        try:
                            total_size += os.path.getsize(filepath)
                            if file.endswith('.mp4'):
                                total_clips += 1
                        except OSError:
                            pass
        
        return {
            'total_projects': len(self.index['projects']),
            'total_clips': total_clips,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'total_size_gb': round(total_size / (1024 * 1024 * 1024), 3)
        }
    
    def get_recent_projects(self, limit: int = 10) -> List[Dict]:
        """
        Get most recent projects.
        
        Args:
            limit: Maximum number to return
        
        Returns:
            List of recent project summaries
        """
        return self.list_projects(limit=limit)
    
    def mark_project_complete(self, project_id: str, total_clips: int):
        """
        Mark a project as complete.
        
        Args:
            project_id: Project to mark complete
            total_clips: Number of clips generated
        """
        self.update_project(project_id, {
            'status': 'complete',
            'total_clips': total_clips
        })
    
    def mark_project_error(self, project_id: str, error: str):
        """
        Mark a project as failed.
        
        Args:
            project_id: Project to mark as error
            error: Error message
        """
        self.update_project(project_id, {
            'status': 'error',
            'error': error
        })
