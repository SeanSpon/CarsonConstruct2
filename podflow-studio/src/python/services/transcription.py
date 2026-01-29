"""
Transcription service using Whisper
Handles chunking for long videos (2+ hours)
"""
import os
import subprocess
import tempfile
from typing import Dict, List, Optional, Any
from pathlib import Path


class TranscriptionService:
    """
    Transcription service using OpenAI Whisper for local transcription.
    
    Supports both local whisper and faster-whisper backends.
    Handles long videos by automatic chunking if needed.
    """
    
    def __init__(self, model_size: str = 'base', device: str = 'auto'):
        """
        Initialize Whisper model.
        
        Args:
            model_size: Model size - 'tiny', 'base', 'small', 'medium', 'large'
            device: 'cpu', 'cuda', or 'auto' (auto-detect)
        """
        self.model_size = model_size
        self.device = device
        self.model = None
        self._use_faster_whisper = False
        
        # Try faster-whisper first (better performance), fallback to openai-whisper
        self._load_model()
    
    def _load_model(self):
        """Load the Whisper model (faster-whisper or openai-whisper)."""
        # Try faster-whisper first
        try:
            from faster_whisper import WhisperModel
            
            # Determine device
            if self.device == 'auto':
                import torch
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
                compute_type = 'float16' if device == 'cuda' else 'int8'
            else:
                device = self.device
                compute_type = 'float16' if device == 'cuda' else 'int8'
            
            print(f"[Transcription] Loading faster-whisper model '{self.model_size}' on {device}")
            self.model = WhisperModel(self.model_size, device=device, compute_type=compute_type)
            self._use_faster_whisper = True
            print(f"[Transcription] Model loaded successfully (faster-whisper)")
            return
        except ImportError:
            print("[Transcription] faster-whisper not available, trying openai-whisper")
        except Exception as e:
            print(f"[Transcription] faster-whisper failed: {e}, trying openai-whisper")
        
        # Fallback to openai-whisper
        try:
            import whisper
            print(f"[Transcription] Loading openai-whisper model '{self.model_size}'")
            self.model = whisper.load_model(self.model_size)
            self._use_faster_whisper = False
            print(f"[Transcription] Model loaded successfully (openai-whisper)")
        except ImportError:
            raise ImportError(
                "Neither faster-whisper nor openai-whisper is installed. "
                "Install with: pip install faster-whisper or pip install openai-whisper"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to load Whisper model: {e}")
    
    def transcribe_video(
        self,
        video_path: str,
        language: str = 'en',
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        Transcribe video with word-level timestamps.
        
        Args:
            video_path: Path to video file
            language: Language code (default: 'en')
            verbose: Whether to print progress
        
        Returns:
            {
                'text': 'full transcript',
                'words': [
                    {'text': 'word', 'start': 0.0, 'end': 0.5},
                    ...
                ],
                'segments': [...],
                'language': 'en'
            }
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        if verbose:
            print(f"[Transcription] Transcribing: {video_path}")
        
        # Extract audio if needed (Whisper works with video files too)
        audio_path = self._prepare_audio(video_path, verbose=verbose)
        
        try:
            if self._use_faster_whisper:
                result = self._transcribe_faster_whisper(audio_path, language, verbose)
            else:
                result = self._transcribe_openai_whisper(audio_path, language, verbose)
        finally:
            # Clean up temp audio file if created
            if audio_path != video_path and os.path.exists(audio_path):
                os.remove(audio_path)
        
        return result
    
    def _prepare_audio(self, video_path: str, verbose: bool = True) -> str:
        """
        Extract audio from video if needed.
        Whisper can handle video files, but extracting audio can be more reliable.
        """
        # Check if it's already an audio file
        ext = Path(video_path).suffix.lower()
        if ext in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']:
            return video_path
        
        # For video files, extract audio to temp WAV
        if verbose:
            print(f"[Transcription] Extracting audio from video...")
        
        temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_audio.close()
        
        try:
            # Use ffmpeg to extract audio
            cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # WAV format
                '-ar', '16000',  # 16kHz sample rate (Whisper's native)
                '-ac', '1',  # Mono
                temp_audio.name
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                # If ffmpeg fails, try with the original file
                print(f"[Transcription] Warning: ffmpeg extraction failed, trying original file")
                os.remove(temp_audio.name)
                return video_path
            
            return temp_audio.name
        except FileNotFoundError:
            # ffmpeg not found, try with original file
            print(f"[Transcription] Warning: ffmpeg not found, trying original file")
            if os.path.exists(temp_audio.name):
                os.remove(temp_audio.name)
            return video_path
    
    def _transcribe_faster_whisper(
        self,
        audio_path: str,
        language: str,
        verbose: bool
    ) -> Dict[str, Any]:
        """Transcribe using faster-whisper."""
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
            vad_filter=True,  # Filter out silence
        )
        
        words = []
        all_segments = []
        full_text_parts = []
        
        for segment in segments:
            segment_dict = {
                'text': segment.text.strip(),
                'start': segment.start,
                'end': segment.end,
            }
            all_segments.append(segment_dict)
            full_text_parts.append(segment.text.strip())
            
            # Extract word-level timestamps
            if segment.words:
                for word in segment.words:
                    words.append({
                        'text': word.word.strip(),
                        'start': word.start,
                        'end': word.end,
                    })
        
        if verbose:
            print(f"[Transcription] Transcribed {len(words)} words in {len(all_segments)} segments")
        
        return {
            'text': ' '.join(full_text_parts),
            'words': words,
            'segments': all_segments,
            'language': info.language if hasattr(info, 'language') else language,
        }
    
    def _transcribe_openai_whisper(
        self,
        audio_path: str,
        language: str,
        verbose: bool
    ) -> Dict[str, Any]:
        """Transcribe using openai-whisper."""
        result = self.model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,
            verbose=verbose,
        )
        
        # Extract word-level timestamps
        words = []
        for segment in result.get('segments', []):
            if 'words' in segment:
                for word in segment['words']:
                    words.append({
                        'text': word.get('word', '').strip(),
                        'start': word.get('start', 0.0),
                        'end': word.get('end', 0.0),
                    })
        
        if verbose:
            print(f"[Transcription] Transcribed {len(words)} words")
        
        return {
            'text': result.get('text', ''),
            'words': words,
            'segments': result.get('segments', []),
            'language': result.get('language', language),
        }
    
    def transcribe_chunk(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        language: str = 'en'
    ) -> Dict[str, Any]:
        """
        Transcribe a specific chunk of video.
        
        Useful for very long videos that need to be processed in parts.
        
        Args:
            video_path: Path to video file
            start_time: Start time in seconds
            end_time: End time in seconds
            language: Language code
        
        Returns:
            Transcript dict with adjusted timestamps
        """
        # Create temporary chunk file
        chunk_path = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        chunk_path.close()
        
        try:
            # Extract chunk using ffmpeg
            cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-ss', str(start_time),
                '-to', str(end_time),
                '-vn',  # No video
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                chunk_path.name
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {result.stderr}")
            
            # Transcribe chunk
            transcript = self.transcribe_video(chunk_path.name, language=language, verbose=False)
            
            # Adjust timestamps to match original video
            for word in transcript['words']:
                word['start'] += start_time
                word['end'] += start_time
            
            for segment in transcript.get('segments', []):
                segment['start'] += start_time
                segment['end'] += start_time
            
            return transcript
        finally:
            # Clean up
            if os.path.exists(chunk_path.name):
                os.remove(chunk_path.name)


def transcribe_video_file(
    video_path: str,
    model_size: str = 'base',
    language: str = 'en'
) -> Dict[str, Any]:
    """
    Convenience function to transcribe a video file.
    
    Args:
        video_path: Path to video file
        model_size: Whisper model size
        language: Language code
    
    Returns:
        Transcript dictionary
    """
    service = TranscriptionService(model_size=model_size)
    return service.transcribe_video(video_path, language=language)
