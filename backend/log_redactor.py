import re
import logging
from typing import Set

class SensitiveDataRedactionFilter(logging.Filter):
    """
    OWASP / Video Checklist Item #8:
    Automatically intercepts and redacts sensitive information (passwords, tokens,
    keys, credit cards, OTPs) from all system logs before they are written.
    """
    SENSITIVE_PATTERNS = [
        # Passwords in JSON / query / text
        (re.compile(r'(["\']?password["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1***REDACTED***\3'),
        # Bearer tokens & JWTs
        (re.compile(r'(Bearer\s+)[A-Za-z0-9\-_\.=]+', re.IGNORECASE), r'\1***REDACTED_JWT***'),
        # API Keys & Secrets
        (re.compile(r'(["\']?(?:api_key|service_role_key|secret|token)["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1***REDACTED***\3'),
        # OTP codes
        (re.compile(r'(["\']?otp(?:_code)?["\']?\s*[:=]\s*["\']?)(\d{4,8})(["\']?)', re.IGNORECASE), r'\1***REDACTED_OTP***\3'),
        # Credit Card Numbers (13-19 digits with optional hyphens/spaces)
        (re.compile(r'\b(?:\d{4}[ -]?){3}(?:\d{4}|\d{1,4})\b'), r'****-****-****-****'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                for pattern, repl in self.SENSITIVE_PATTERNS:
                    record.msg = pattern.sub(repl, record.msg)
            if record.args:
                new_args = []
                for arg in record.args:
                    if isinstance(arg, str):
                        for pattern, repl in self.SENSITIVE_PATTERNS:
                            arg = pattern.sub(repl, arg)
                    new_args.append(arg)
                record.args = tuple(new_args)
        except Exception:
            pass
        return True
