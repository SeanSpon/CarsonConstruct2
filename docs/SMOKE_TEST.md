# Smoke Test (PodFlow Studio)

Use these steps to verify the MVP flow after a build or install.

## Prereqs
- FFmpeg available in your PATH
- Python dependencies installed (see `podflow-studio/README.md`)
- A short `.mp4` or `.mov` sample file
- OpenAI API key only if you want to test AI enhancement

## Steps
1. From `podflow-studio`, run `npm install` and `npm start`.
2. On the Home page, drag and drop a `.mp4` or `.mov`, or choose a file.
3. Confirm file details render and the "Start Analysis" button is enabled.
4. Click "Start Analysis" and verify progress updates in Clip Finder.
5. Open Auto Edit and confirm dead space entries render and toggle.
6. Open Export, choose an output folder, and export clips.

## Expected results
- No crashes or unhandled errors.
- Clip list and dead space list populate.
- Export completes and outputs playable files.
