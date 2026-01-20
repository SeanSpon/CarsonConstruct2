"""
Detection Stage - Deterministic clip candidate detection.

Detection criteria (ALL are deterministic, no AI):
- Speech density (words/sec from transcript)
- Silence → speech spike (energy contrast)
- Sentence boundaries (natural cut points)
- Length window (15-60s default)

Output: clip candidates with start/end timestamps + score + reason
"""

from .candidates import detect_candidates, Candidate
from .scoring import score_and_rank, ScoredClip
