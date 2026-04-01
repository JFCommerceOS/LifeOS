"""
Minimal deterministic pre-LLM policy guard (regex).
Aligns with A-S-FLC MODEL_CARD intent: block obvious credential harvest, scams, injection, plaintext PII.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class PolicyResult:
    allowed: bool
    matched_rules: List[str] = field(default_factory=list)
    pii_types: List[str] = field(default_factory=list)
    block_reason: str | None = None


# --- Injection / jailbreak (subset; extend as needed) ---
_INJECTION_PATTERNS = [
    (r"(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions", "injection_ignore_instructions"),
    (r"(?i)\bDAN\b.*\bmode\b", "injection_dan"),
    (r"(?i)system\s*:\s*you\s+are\s+now", "injection_system_override"),
    (r"(?i)```\s*system", "injection_fence_system"),
    (r"(?i)base64\s*decode", "injection_base64_hook"),
]

# --- Scam / fraud hooks ---
_SCAM_PATTERNS = [
    (r"(?i)gift\s*card\s*(only|payment|code)", "scam_gift_card"),
    (r"(?i)wire\s+transfer\s+.*\s+urgent", "scam_urgent_wire"),
    (r"(?i)send\s+(btc|bitcoin|eth|ethereum)\s+first", "scam_crypto_first"),
]

# --- Credential harvest ---
_CRED_PATTERNS = [
    (r"(?i)\bCVV\b", "cred_cvv"),
    (r"(?i)\bone[- ]time\s+password\b", "cred_otp_phish"),
    (r"(?i)\bseed\s+phrase\b", "cred_seed"),
    (r"(?i)\bSSN\b\s*[:#]?\s*\d{3}", "cred_ssn"),
]

# --- Plaintext PII (deterministic; conservative to limit false positives) ---
_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b")
_BTC_RE = re.compile(r"\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}\b")
# 16 consecutive digits (possible PAN) — ignores spaces/dashes in chunk
_PAN_RUN = re.compile(r"(?:\D|^)(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})(?:\D|$)")


def evaluate_policy(user_text: str) -> PolicyResult:
    text = user_text or ""
    matched: List[str] = []
    pii: List[str] = []

    for pat, name in _INJECTION_PATTERNS + _SCAM_PATTERNS + _CRED_PATTERNS:
        if re.search(pat, text):
            matched.append(name)

    if _PAN_RUN.search(text):
        pii.append("credit_card_pattern")
    if _IBAN_RE.search(text):
        pii.append("iban")
    if _BTC_RE.search(text):
        pii.append("crypto_address")

    if matched:
        return PolicyResult(
            allowed=False,
            matched_rules=matched,
            pii_types=pii or None,
            block_reason="policy_guard_rule",
        )
    if pii:
        return PolicyResult(
            allowed=False,
            matched_rules=["pii_plaintext"],
            pii_types=pii,
            block_reason="pii_plaintext",
        )
    return PolicyResult(allowed=True, matched_rules=[], pii_types=[])
