### Quick test
- Run unit tests (from `podflow-studio/src/python`):
  - `python -m unittest discover -s tests`
- Run eval harness:
  - `python tools/eval/run_eval.py --dataset data/sample.json --k 10`
- Run app detection on a local mp4 and confirm:
  - Progress updates feel smooth (not spammy)
  - Clips have snapped boundaries (no mid-word starts/ends)
  - Clips show score breakdown + pattern labels incl. "debate"
