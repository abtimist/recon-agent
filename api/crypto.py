"""
AES-256-GCM encryption for user API keys stored in the database.

Why encrypt at the application layer when Supabase encrypts at rest?
  - Defence in depth: if the DB backup is exfiltrated, keys are still
    encrypted with a secret the DB doesn't have.
  - Principle of least privilege: the DB only stores ciphertext; only
    the API server (with ENCRYPTION_KEY in its env) can decrypt.

ENCRYPTION_KEY must be a 32-byte random value, base64-encoded.
Generate one with:
    python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_raw_key = os.environ.get("ENCRYPTION_KEY", "")


def _get_key() -> bytes:
    if not _raw_key:
        raise RuntimeError(
            "ENCRYPTION_KEY env var is not set. "
            "Generate one with: python -c \"import os, base64; print(base64.b64encode(os.urandom(32)).decode())\""
        )
    key = base64.b64decode(_raw_key)
    if len(key) != 32:
        raise RuntimeError("ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).")
    return key


def encrypt(plaintext: str) -> str:
    """
    Encrypt a string and return a base64-encoded ciphertext.
    Format: base64(nonce [12 bytes] + ciphertext)
    """
    key   = _get_key()
    nonce = os.urandom(12)           # 96-bit nonce, unique per encryption
    ct    = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt(ciphertext_b64: str) -> str:
    """
    Decrypt a ciphertext produced by encrypt(). Returns the original string.
    Raises cryptography.exceptions.InvalidTag if the key or data is wrong.
    """
    key     = _get_key()
    raw     = base64.b64decode(ciphertext_b64)
    nonce   = raw[:12]
    ct      = raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode()
