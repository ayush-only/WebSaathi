# backend/ — Person 1
Node + Express proxy to AWS Bedrock. Start from `legacy/apps/backend/` (schema validation, redaction, safety gate already exist).
New endpoint needed: `POST /api/extract` → facts with exact excerpts from the page text (see `contract/case.md`).
