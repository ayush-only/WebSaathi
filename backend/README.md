# Optional backend

Install its dependencies with `npm install --prefix backend`. Configure providers in a git-ignored `.env` at the repo root or in `backend/`, then run `npm --prefix backend start`.

The extension works with local extraction and browser voices by default. With Bedrock configured, `POST /api/extract` can return additional facts whose excerpts and values appear on the practice seller page. ElevenLabs is optional for read-aloud. The server listens on loopback.
