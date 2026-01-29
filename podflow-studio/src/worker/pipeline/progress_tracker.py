"""
Track pipeline progress and enable checkpointing.

This module provides:
- Progress tracking through pipeline stages
- Checkpointing for resumable jobs
- Progress reporting and summaries
"""
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable


class ProgressTracker:
    """
    Tracks progress through the clip generation pipeline.
    
    Supports:
    - Stage-by-stage progress tracking
    - Checkpoint save/restore for resume
    - Progress callbacks for UI updates
    - Time estimates based on progress
    """
    
    # Pipeline stages with their weights for overall progress
    STAGES = {
        'preparing': {'weight': 0.05, 'description': 'Preparing files'},
        'transcription': {'weight': 0.30, 'description': 'Transcribing audio'},
        'detection': {'weight': 0.15, 'description': 'Detecting stories'},
        'rendering': {'weight': 0.40, 'description': 'Rendering clips'},
        'export': {'weight': 0.10, 'description': 'Exporting files'}
    }
    
    def __init__(
        self,
        job_id: str,
        checkpoint_dir: str = './checkpoints',
        progress_callback: Callable[[Dict[str, Any]], None] = None
    ):
        """
        Initialize progress tracker.
        
        Args:
            job_id: Unique identifier for this job
            checkpoint_dir: Directory for checkpoint files
            progress_callback: Optional callback for progress updates
        """
        self.job_id = job_id
        self.checkpoint_dir = checkpoint_dir
        self.checkpoint_path = os.path.join(checkpoint_dir, f"{job_id}.json")
        self.progress_callback = progress_callback
        
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        # Initialize state
        self.state = {
            'job_id': job_id,
            'started_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'status': 'initializing',
            'current_stage': 'preparing',
            'stages': {
                stage: {
                    'status': 'pending',
                    'progress': 0,
                    'message': '',
                    'started_at': None,
                    'completed_at': None
                }
                for stage in self.STAGES
            },
            'clips_processed': 0,
            'clips_total': 0,
            'clips_generated': [],
            'errors': [],
            'warnings': []
        }
    
    def update_stage(
        self,
        stage: str,
        status: str,
        progress: int = 0,
        message: str = ''
    ):
        """
        Update the status of a pipeline stage.
        
        Args:
            stage: Stage name (preparing, transcription, etc.)
            status: Status (pending, running, complete, error)
            progress: Progress percentage (0-100)
            message: Optional status message
        """
        if stage not in self.state['stages']:
            return
        
        stage_state = self.state['stages'][stage]
        
        # Track timing
        if status == 'running' and stage_state['started_at'] is None:
            stage_state['started_at'] = datetime.now().isoformat()
        elif status == 'complete':
            stage_state['completed_at'] = datetime.now().isoformat()
        
        stage_state['status'] = status
        stage_state['progress'] = progress
        stage_state['message'] = message
        
        self.state['current_stage'] = stage
        self.state['updated_at'] = datetime.now().isoformat()
        
        # Update overall status
        if status == 'error':
            self.state['status'] = 'error'
        elif self._all_stages_complete():
            self.state['status'] = 'complete'
        else:
            self.state['status'] = 'running'
        
        # Save checkpoint
        self._save_checkpoint()
        
        # Notify callback
        self._notify_progress()
    
    def set_clip_count(self, total: int):
        """
        Set the total number of clips to process.
        
        Args:
            total: Total clip count
        """
        self.state['clips_total'] = total
        self._save_checkpoint()
    
    def mark_clip_complete(self, clip_data: Dict[str, Any]):
        """
        Mark a clip as completed.
        
        Args:
            clip_data: Information about the completed clip
        """
        self.state['clips_generated'].append(clip_data)
        self.state['clips_processed'] += 1
        self.state['updated_at'] = datetime.now().isoformat()
        
        self._save_checkpoint()
        self._notify_progress()
    
    def log_error(self, error: str, stage: str = None):
        """
        Log an error.
        
        Args:
            error: Error message
            stage: Stage where error occurred
        """
        error_entry = {
            'error': error,
            'stage': stage or self.state['current_stage'],
            'timestamp': datetime.now().isoformat()
        }
        self.state['errors'].append(error_entry)
        self._save_checkpoint()
    
    def log_warning(self, warning: str):
        """
        Log a warning.
        
        Args:
            warning: Warning message
        """
        warning_entry = {
            'warning': warning,
            'timestamp': datetime.now().isoformat()
        }
        self.state['warnings'].append(warning_entry)
    
    def get_overall_progress(self) -> int:
        """
        Calculate overall progress percentage.
        
        Returns:
            Progress percentage (0-100)
        """
        total = 0
        
        for stage, config in self.STAGES.items():
            stage_progress = self.state['stages'][stage]['progress']
            total += stage_progress * config['weight']
        
        return int(total)
    
    def get_estimated_time_remaining(self) -> Optional[int]:
        """
        Estimate remaining time in seconds.
        
        Returns:
            Estimated seconds remaining, or None if not calculable
        """
        progress = self.get_overall_progress()
        
        if progress < 5:  # Not enough data
            return None
        
        started_at = datetime.fromisoformat(self.state['started_at'])
        elapsed = (datetime.now() - started_at).total_seconds()
        
        if progress > 0:
            total_estimated = elapsed / (progress / 100)
            remaining = total_estimated - elapsed
            return max(0, int(remaining))
        
        return None
    
    def can_resume(self) -> bool:
        """
        Check if job can be resumed from checkpoint.
        
        Returns:
            True if job can be resumed
        """
        if not os.path.exists(self.checkpoint_path):
            return False
        
        # Check if any stage is incomplete
        for stage_data in self.state['stages'].values():
            if stage_data['status'] not in ['complete', 'skipped']:
                return True
        
        return False
    
    def load_checkpoint(self) -> Dict[str, Any]:
        """
        Load state from checkpoint file.
        
        Returns:
            Loaded state dict
        """
        if os.path.exists(self.checkpoint_path):
            try:
                with open(self.checkpoint_path, 'r') as f:
                    self.state = json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        
        return self.state
    
    def get_resume_point(self) -> str:
        """
        Determine which stage to resume from.
        
        Returns:
            Stage name to resume from
        """
        for stage in self.STAGES:
            stage_status = self.state['stages'][stage]['status']
            if stage_status not in ['complete', 'skipped']:
                return stage
        
        return 'export'  # All done, just need final export
    
    def _save_checkpoint(self):
        """Save current state to checkpoint file."""
        try:
            with open(self.checkpoint_path, 'w') as f:
                json.dump(self.state, f, indent=2)
        except IOError:
            pass
    
    def _all_stages_complete(self) -> bool:
        """Check if all stages are complete."""
        for stage_data in self.state['stages'].values():
            if stage_data['status'] not in ['complete', 'skipped']:
                return False
        return True
    
    def _notify_progress(self):
        """Send progress update to callback."""
        if self.progress_callback:
            self.progress_callback({
                'job_id': self.job_id,
                'progress': self.get_overall_progress(),
                'stage': self.state['current_stage'],
                'message': self.state['stages'][self.state['current_stage']]['message'],
                'clips_processed': self.state['clips_processed'],
                'clips_total': self.state['clips_total']
            })
    
    def get_summary(self) -> str:
        """
        Get human-readable progress summary.
        
        Returns:
            Multi-line progress summary string
        """
        lines = [
            f"Job: {self.job_id}",
            f"Status: {self.state['status']}",
            f"Overall Progress: {self.get_overall_progress()}%",
            "",
            "Stages:"
        ]
        
        status_icons = {
            'pending': '⏳',
            'running': '🔄',
            'complete': '✅',
            'error': '❌',
            'skipped': '⏭️'
        }
        
        for stage, config in self.STAGES.items():
            data = self.state['stages'][stage]
            icon = status_icons.get(data['status'], '❓')
            
            line = f"  {icon} {config['description']}: {data['status']}"
            if data['progress'] > 0 and data['status'] == 'running':
                line += f" ({data['progress']}%)"
            
            lines.append(line)
        
        lines.append("")
        lines.append(f"Clips: {self.state['clips_processed']}/{self.state['clips_total']}")
        
        if self.state['errors']:
            lines.append(f"Errors: {len(self.state['errors'])}")
        
        eta = self.get_estimated_time_remaining()
        if eta:
            minutes = eta // 60
            seconds = eta % 60
            lines.append(f"ETA: {minutes}m {seconds}s")
        
        return '\n'.join(lines)
    
    def cleanup(self):
        """Remove checkpoint file after successful completion."""
        if os.path.exists(self.checkpoint_path):
            os.remove(self.checkpoint_path)
