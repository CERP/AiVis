# Security

## Uploaded data

Treated as potentially sensitive by default. Never trust filename, extension, or
client-provided MIME type — files are validated by extension, sniffed MIME/magic bytes, actual
structural parse, and size limit before acceptance. Uploads are stored in object storage
outside the application filesystem, accessed only via signed URLs.

## AuthN/AuthZ

Session-based auth with hashed passwords (bcrypt via passlib), JWT for API access, RBAC
foundation (`organizations` / `memberships`) for tenant isolation. Every dataset/project query
is scoped to the requesting user's organization.

## AI safety

See [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md): data minimization, PII detection, no arbitrary
AI-generated code execution, structured-output validation.

## Never

- Execute uploaded files.
- Execute AI-generated code.
- Send a raw dataset wholesale to an LLM.
- Log dataset contents or PII.
- Commit secrets or `.env` files.

## Reporting

Report suspected vulnerabilities via the project's issue tracker with a minimal reproduction;
do not open a public issue for anything exploitable in production until it's patched.
