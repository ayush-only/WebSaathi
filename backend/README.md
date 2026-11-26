# Optional backend

The refund demo reads facts locally and uses the browser voice. You can run it without this server or an API key.

For optional AI extraction, copy `backend/.env.example` to `backend/.env` and set `LLM_API_KEY`. The default endpoint is Groq with `openai/gpt-oss-20b`, which is available on its [free plan](https://console.groq.com/docs/rate-limits). For another OpenAI-compatible chat provider, set its `LLM_BASE_URL` and `LLM_MODEL`. Keep credentials in the ignored .env file.

From the repo root, run `npm install` and `npm start --workspace backend`. The server listens on loopback. Set `ALLOWED_EXTENSION_IDS` to the unpacked extension ID shown at `chrome://extensions`. It redacts the practice page before sending it and checks each proposed fact against the page. Missing credentials, rate limits, and failed responses use local extraction.

For AWS, set `LLM_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, and AWS credentials. Existing Bedrock-only configurations continue to work. ElevenLabs remains optional for read-aloud.

Run the backend regression test with `npm test --workspace backend`. It uses a local provider stub.
