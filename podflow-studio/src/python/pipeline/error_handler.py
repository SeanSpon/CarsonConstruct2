"""
Centralized error handling and recovery for the pipeline.

This module provides:
- Custom exception types for each pipeline stage
- Centralized logging
- Error recovery suggestions
- Safe execution decorators
"""
import logging
import traceback
import sys
from typing import Callable, Any, Dict, List, Optional
from functools import wraps
from datetime import datetime


# Custom exception types
class PipelineError(Exception):
    """Base exception for all pipeline errors."""
    
    def __init__(self, message: str, stage: str = None, recoverable: bool = True):
        self.message = message
        self.stage = stage
        self.recoverable = recoverable
        self.timestamp = datetime.now().isoformat()
        super().__init__(self.message)


class TranscriptionError(PipelineError):
    """Error during transcription stage."""
    
    def __init__(self, message: str):
        super().__init__(message, stage='transcription', recoverable=True)


class DetectionError(PipelineError):
    """Error during clip detection stage."""
    
    def __init__(self, message: str):
        super().__init__(message, stage='detection', recoverable=True)


class RenderError(PipelineError):
    """Error during video rendering stage."""
    
    def __init__(self, message: str, clip_index: int = None):
        super().__init__(message, stage='rendering', recoverable=True)
        self.clip_index = clip_index


class ExportError(PipelineError):
    """Error during export stage."""
    
    def __init__(self, message: str, format_id: str = None):
        super().__init__(message, stage='export', recoverable=True)
        self.format_id = format_id


class ConfigurationError(PipelineError):
    """Error in pipeline configuration."""
    
    def __init__(self, message: str):
        super().__init__(message, stage='configuration', recoverable=False)


class ErrorHandler:
    """
    Centralized error handling with logging and recovery suggestions.
    """
    
    def __init__(self, log_path: str = None, log_level: int = logging.INFO):
        """
        Initialize error handler.
        
        Args:
            log_path: Path to log file (None for console only)
            log_level: Logging level
        """
        self.logger = logging.getLogger('PodFlow')
        self.logger.setLevel(log_level)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)
        
        # File handler (if path provided)
        if log_path:
            file_handler = logging.FileHandler(log_path)
            file_handler.setLevel(logging.DEBUG)
            file_format = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            file_handler.setFormatter(file_format)
            self.logger.addHandler(file_handler)
        
        # Error history
        self.error_history: List[Dict[str, Any]] = []
    
    def log_error(
        self,
        error: Exception,
        context: str = '',
        extra_info: Dict[str, Any] = None
    ):
        """
        Log an error with context.
        
        Args:
            error: The exception that occurred
            context: Description of what was happening
            extra_info: Additional information to log
        """
        error_entry = {
            'timestamp': datetime.now().isoformat(),
            'type': type(error).__name__,
            'message': str(error),
            'context': context,
            'extra_info': extra_info or {},
            'traceback': traceback.format_exc()
        }
        
        self.error_history.append(error_entry)
        
        self.logger.error(f"{context}: {error}")
        self.logger.debug(traceback.format_exc())
    
    def log_warning(self, message: str, context: str = ''):
        """Log a warning message."""
        self.logger.warning(f"{context}: {message}" if context else message)
    
    def log_info(self, message: str):
        """Log an info message."""
        self.logger.info(message)
    
    def handle_transcription_error(
        self,
        error: Exception,
        video_path: str
    ) -> Dict[str, Any]:
        """
        Handle transcription errors with recovery suggestions.
        
        Args:
            error: The exception that occurred
            video_path: Path to the video being transcribed
        
        Returns:
            Dict with error info and recovery suggestions
        """
        self.log_error(error, f"Transcription failed for {video_path}")
        
        error_str = str(error).lower()
        suggestions = []
        
        if 'ffmpeg' in error_str:
            suggestions.append("FFmpeg not found. Install FFmpeg and add to PATH.")
            suggestions.append("On macOS: brew install ffmpeg")
            suggestions.append("On Windows: choco install ffmpeg")
        
        if 'memory' in error_str or 'oom' in error_str:
            suggestions.append("Insufficient memory. Try:")
            suggestions.append("  - Use a smaller Whisper model (tiny or base)")
            suggestions.append("  - Close other applications")
            suggestions.append("  - Process video in chunks")
        
        if 'timeout' in error_str:
            suggestions.append("Transcription timeout. Video may be too long.")
            suggestions.append("Try chunking the video into smaller segments.")
        
        if 'cuda' in error_str or 'gpu' in error_str:
            suggestions.append("GPU error. Try running on CPU instead.")
            suggestions.append("Set device='cpu' in transcription config.")
        
        if not suggestions:
            suggestions.append("Check if the video file is valid and accessible.")
            suggestions.append("Try re-encoding the video to a standard format.")
        
        return {
            'error': str(error),
            'error_type': type(error).__name__,
            'context': video_path,
            'suggestions': suggestions,
            'recovery_options': ['retry', 'use_smaller_model', 'chunk_video']
        }
    
    def handle_render_error(
        self,
        error: Exception,
        clip_index: int
    ) -> Dict[str, Any]:
        """
        Handle rendering errors.
        
        Args:
            error: The exception that occurred
            clip_index: Index of the clip being rendered
        
        Returns:
            Dict with error info and recovery suggestions
        """
        self.log_error(error, f"Rendering failed for clip {clip_index}")
        
        error_str = str(error).lower()
        suggestions = []
        
        if 'codec' in error_str:
            suggestions.append("Codec error. Check FFmpeg installation.")
            suggestions.append("Try using a different output codec.")
        
        if 'memory' in error_str:
            suggestions.append("Memory error. Try:")
            suggestions.append("  - Reduce video resolution")
            suggestions.append("  - Process fewer clips at once")
            suggestions.append("  - Increase system swap space")
        
        if 'permission' in error_str or 'access' in error_str:
            suggestions.append("Permission error. Check output directory access.")
        
        if not suggestions:
            suggestions.append("Try re-running with a different clip.")
            suggestions.append("Check input video integrity.")
        
        return {
            'error': str(error),
            'error_type': type(error).__name__,
            'clip_index': clip_index,
            'suggestions': suggestions,
            'recovery_options': ['skip_clip', 'reduce_quality', 'retry']
        }
    
    def get_error_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all errors encountered.
        
        Returns:
            Dict with error counts and recent errors
        """
        if not self.error_history:
            return {
                'total_errors': 0,
                'recent_errors': [],
                'by_type': {}
            }
        
        # Count by type
        by_type = {}
        for err in self.error_history:
            err_type = err['type']
            by_type[err_type] = by_type.get(err_type, 0) + 1
        
        return {
            'total_errors': len(self.error_history),
            'recent_errors': self.error_history[-5:],
            'by_type': by_type
        }
    
    def clear_history(self):
        """Clear error history."""
        self.error_history = []
    
    @staticmethod
    def safe_execute(
        error_type: type = Exception,
        default_return: Any = None,
        log_errors: bool = True
    ):
        """
        Decorator for safe function execution.
        
        Args:
            error_type: Exception type to catch
            default_return: Value to return on error
            log_errors: Whether to log errors
        
        Returns:
            Decorated function
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                try:
                    return func(*args, **kwargs)
                except error_type as e:
                    if log_errors:
                        handler = ErrorHandler()
                        handler.log_error(e, f"Error in {func.__name__}")
                    return default_return
            return wrapper
        return decorator
    
    @staticmethod
    def retry(
        max_attempts: int = 3,
        delay: float = 1.0,
        exceptions: tuple = (Exception,)
    ):
        """
        Decorator to retry failed operations.
        
        Args:
            max_attempts: Maximum retry attempts
            delay: Delay between retries (seconds)
            exceptions: Tuple of exceptions to retry on
        
        Returns:
            Decorated function
        """
        import time
        
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                last_error = None
                
                for attempt in range(max_attempts):
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        last_error = e
                        if attempt < max_attempts - 1:
                            time.sleep(delay * (attempt + 1))
                
                raise last_error
            return wrapper
        return decorator
