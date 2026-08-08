import re


DROP_WORDS = {
    "store",
    "market",
    "mktp",
    "com",
    "usa",
    "us",
    "oil",
    "gas",
    "station",
    "new",
    "east",
    "brunswick",
    "sayreville",
    "nj",
    "f",
}


MERCHANT_ALIASES = {
    "amzn": "amazon",
}


def normalize_merchant(description: str) -> str:
    """
    Convert a cleaned bank transaction description
    into a normalized merchant name.
    """

    if not description:
        return ""

    description = description.lower().strip()

    tokens = re.findall(
        r"[a-z]+",
        description,
    )

    useful_tokens = [
        token
        for token in tokens
        if token not in DROP_WORDS
    ]

    merchant = " ".join(useful_tokens).strip()

    merchant = MERCHANT_ALIASES.get(
        merchant,
        merchant,
    )

    return merchant


if __name__ == "__main__":

    examples = [
        "chipotle new brunswick nj",
        "shoprite east brunswick nj",
        "netflix com",
        "exxon sayreville nj",
        "amzn mktp us",
        "starbucks store",
        "whole foods market",
        "shell oil",
        "bp gas station",
    ]

    for example in examples:
        print(
            f"{example:30} -> "
            f"{normalize_merchant(example)}"
        )