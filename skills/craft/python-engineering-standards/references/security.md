# Security

The full security standard. Read this when the task touches credentials, authentication, API endpoints, file permissions, or paths derived from external input. The Security section of the root `SKILL.md` sets the non-negotiable floor; this file explains the reasoning and cases behind it.

Scope note: this file covers how to handle secret *values* in code. `references/operational.md`, under "Secrets & Credentials", covers the secrets *lifecycle*: where to fetch them, ephemeral storage for key material, and rotation.

## Credential fields

Use `SecretStr` for any credential field. Pydantic's `SecretStr` helps mask accidental exposure in `repr()`, `str()`, and serialization (exact JSON behavior varies by Pydantic version and serialization options). Access the value only through `.get_secret_value()`, an explicit, auditable call.

```python
from pydantic import BaseModel, SecretStr

class AirflowConfig(BaseModel):
    host: str
    airflow_password: SecretStr
    airflow_token: SecretStr
```

`SecretStr` reduces accidental leaks but is not a security boundary: after you call `.get_secret_value()`, pass the result to a library, include it in an exception, or serialize it manually, it can still leak. If you are not using Pydantic, wrap secrets in a type that hides them from `__repr__` and `__str__`.

## Secrets in logs

None. Not even at DEBUG. `SecretStr` handles logged config objects, but also avoid logging raw request/response bodies from auth endpoints, connection strings, or headers that carry tokens. Configure request logging to redact `Authorization`, cookies, and sensitive headers; do not assume your framework does this by default.

## Where secrets live

Prefer secret stores for production and env vars as a minimum. CLI args appear in `ps aux` and shell history, so never use them for secrets. Environment variables are better but can still leak through child processes, crash dumps, and misconfigured logging. For production systems, use Secrets Manager, Parameter Store, or Vault.

## SQL

Use parameterized queries only. Never f-string or `.format()` user/external input into SQL. Every database driver supports parameterized queries; use them.

Parameters work for *values*, not SQL identifiers (table/column names). Dynamic identifiers should come from an allowlist, never from user input directly.

## File permissions

Create files with restrictive permissions from the start. Do not create a file and then `chmod`: before the mode change, it is world-readable. `O_EXCL` avoids accidentally replacing an existing file:

```python
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as file:
    file.write(secret)
```

## TLS

Use HTTPS for all network calls, including internal calls, with certificate verification on. Never set `verify=False` in requests/httpx; it disables certificate validation entirely and makes the connection vulnerable to interception. If you need a custom CA, point `verify=` at the CA bundle path.

## Deserialization & code execution

Never use `pickle.load()`, `eval()`, or `exec()` on untrusted input. They execute arbitrary code. Use safe serialization (JSON, MessagePack, protobuf) for data exchange.

Use `yaml.safe_load()`, not `yaml.load()`. The full loader can instantiate arbitrary Python objects from YAML.

## Subprocess

Avoid `shell=True`. Pass arguments as a list to prevent shell injection: `subprocess.run(["ls", "-la", path])`, not `subprocess.run(f"ls -la {path}", shell=True)`.

## Path handling

Validate and normalize file paths. Prevent path traversal by resolving paths and checking that they stay within the expected directory: `resolved.relative_to(base_dir)` raises `ValueError` if it escapes.

## API endpoints

When building or consuming APIs that handle credentials:

- **Never send credentials in GET query parameters.** URLs appear in server access logs, proxy caches, browser history, CDN edge logs, and error reporting. Put passwords and tokens in the request body (POST) or the `Authorization` header, never in the URL.
- **Use the `Authorization: Bearer <token>` header.** It exists for this purpose. Configure your reverse proxy and application logging to redact it; do not assume this happens automatically.
- **Don't echo secrets back in responses.** If an endpoint creates an API key, return it once. After that, return only a masked version (`"ak_...7f2d"`). Store API keys hashed. For long random API keys, HMAC-SHA-256 with a server-side pepper is acceptable for verification. Use the same approach for config endpoints that might expose connection strings.
- **Hash passwords with Argon2, bcrypt, or scrypt.** General-purpose hashes (SHA-256, MD5) are fast, so a GPU can compute billions per second and make password-space exhaustion feasible. Password-hashing algorithms are deliberately slow and memory-hard. Use `argon2-cffi` or `passlib`. Do not reuse this pattern for API keys; those are long random strings where speed is not the threat model.
