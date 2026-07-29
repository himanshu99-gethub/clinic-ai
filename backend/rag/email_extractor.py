"""
Email Extractor — scans vector store content and extracts valid, unique email addresses.
Uses regex for extraction + validation, with deduplication and source tracking.
"""

import re
from typing import List, Dict, Any
from email_validator import validate_email, EmailNotValidError


# Comprehensive email regex — handles most real-world formats
EMAIL_REGEX = re.compile(
    r"""(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+"""
    r"""(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*"""
    r"""|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]"""
    r"""|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")"""
    r"""@"""
    r"""(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+"""
    r"""[a-zA-Z]{2,}""",
    re.MULTILINE
)

# Known disposable / test domains to flag
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com",
    "throwaway.email", "yopmail.com", "sharklasers.com"
}


def extract_emails_from_text(text: str, source: str = "unknown") -> List[Dict[str, Any]]:
    """
    Extract raw email matches from a single text block.
    Returns list of {email, source, raw}.
    """
    raw_matches = EMAIL_REGEX.findall(text)
    results = []
    for match in raw_matches:
        results.append({
            "email": match.lower().strip(),
            "source": source,
        })
    return results


def validate_and_deduplicate(
    raw_emails: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Takes a list of raw email dicts and returns:
    {
        valid: [...],
        invalid: [...],
        duplicates: [...],
        stats: {...}
    }
    """
    seen: set = set()
    valid: List[Dict] = []
    invalid: List[Dict] = []
    duplicates: List[Dict] = []

    for item in raw_emails:
        email = item["email"].lower().strip()

        # Skip empty
        if not email:
            continue

        # Check duplicate first
        if email in seen:
            duplicates.append({**item, "status": "duplicate"})
            continue

        # Validate format using email-validator
        try:
            validated = validate_email(email, check_deliverability=False)
            norm_email = validated.normalized
        except EmailNotValidError:
            invalid.append({**item, "email": email, "status": "invalid"})
            continue

        # Flag disposable
        domain = norm_email.split("@")[-1].lower()
        is_disposable = domain in DISPOSABLE_DOMAINS

        seen.add(email)
        valid.append({
            **item,
            "email": norm_email,
            "domain": domain,
            "status": "valid",
            "is_disposable": is_disposable,
        })

    return {
        "valid": valid,
        "invalid": invalid,
        "duplicates": duplicates,
        "stats": {
            "total_extracted": len(raw_emails),
            "valid_count": len(valid),
            "invalid_count": len(invalid),
            "duplicate_count": len(duplicates),
        }
    }


def extract_from_vector_store(store) -> Dict[str, Any]:
    """
    Run full extraction pipeline on all content in a VectorStore.
    """
    all_content = store.get_all_content()
    # Also query specific email-related chunks for better recall
    email_queries = ["email address", "contact", "@gmail", "@yahoo", "@hotmail", "email:"]

    all_raw = extract_emails_from_text(all_content, source="full_scan")

    # Deduplicate the raw list by email string before validation
    seen_raw = set()
    unique_raw = []
    for item in all_raw:
        if item["email"] not in seen_raw:
            seen_raw.add(item["email"])
            unique_raw.append(item)

    return validate_and_deduplicate(unique_raw)
