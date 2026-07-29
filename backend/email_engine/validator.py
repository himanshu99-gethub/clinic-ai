"""
Email Validator — standalone validation utilities.
"""

import re
from email_validator import validate_email, EmailNotValidError


def is_valid_email(email: str) -> bool:
    """Check if a string is a syntactically valid email address."""
    try:
        validate_email(email.strip(), check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def normalize_email(email: str) -> str:
    """Return normalized (lowercase, stripped) email or raise ValueError."""
    try:
        result = validate_email(email.strip(), check_deliverability=False)
        return result.normalized
    except EmailNotValidError as e:
        raise ValueError(str(e))
