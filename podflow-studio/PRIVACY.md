# Privacy Policy

**SeeZee ClipBot Studio**  
*Last Updated: January 2026*

---

## Overview

SeeZee ClipBot Studio ("the Application") is a desktop application for AI-powered podcast clip detection. This privacy policy explains how we handle your data.

---

## Data Collection

### What We DO NOT Collect

- **No telemetry:** We do not collect usage analytics or crash reports
- **No cloud storage:** Your videos and projects stay on your computer
- **No account required:** The application works fully offline
- **No tracking:** We do not track your behavior or usage patterns

### What Stays Local

All of the following data remains exclusively on your device:

- Video files you process
- Detected clips and transcripts
- Project files (.podflow)
- Cache data (transcripts, thumbnails)
- Application settings
- API keys you configure

---

## API Keys

### OpenAI API Key (Optional)

If you choose to use AI-enhanced transcription:

- Your API key is stored locally using your operating system's secure credential storage
- The key is sent directly to OpenAI's servers for transcription requests
- We do not have access to your API key
- OpenAI's privacy policy applies to data sent to their services: https://openai.com/policies/privacy-policy

### Other API Keys

Similar policies apply to any other optional API integrations (e.g., HuggingFace for speaker diarization).

---

## Data Processing

### Video Processing

- All video processing happens locally on your computer
- Videos are never uploaded to any server
- Transcripts are generated locally (or via your configured API)

### AI Features

When AI enhancement is enabled:
- Audio may be sent to third-party AI services (OpenAI, etc.)
- This is controlled by your API key configuration
- You can disable AI features to keep everything local

---

## Data Storage

### Local Storage Locations

The application stores data in standard locations:

- **Windows:** `%APPDATA%/seezee-clipbot-studio/`
- **macOS:** `~/Library/Application Support/seezee-clipbot-studio/`
- **Linux:** `~/.config/seezee-clipbot-studio/`

### What's Stored

- Project metadata and cache
- User preferences
- Encrypted API keys (using OS keychain)

---

## Third-Party Services

The application may interact with these services only if you configure them:

| Service | Purpose | When Used |
|---------|---------|-----------|
| OpenAI | Transcription | If you provide an API key |
| HuggingFace | Speaker diarization | If you provide a token |

---

## Your Rights

You have complete control over your data:

- **Access:** All your data is stored locally and accessible
- **Delete:** Uninstall the app to remove all local data
- **Export:** Project files are standard JSON and fully portable
- **Opt-out:** Disable any network features by not configuring API keys

---

## Children's Privacy

This application is not directed at children under 13. We do not knowingly collect data from children.

---

## Changes to This Policy

We may update this privacy policy. Changes will be noted in application release notes.

---

## Contact

For privacy questions, contact: [Your Contact Email]

---

*This is a local-first application. Your data stays with you.*
