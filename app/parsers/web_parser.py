import requests
from bs4 import BeautifulSoup
import re

def extract_text_from_url(url: str) -> dict:
    """Fetches and cleans web page content."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract title
    title = soup.title.string.strip() if soup.title and soup.title.string else url

    # Remove script, style, nav, footer, ads
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "svg"]):
        tag.decompose()

    # Get body or main content
    main_elem = soup.find("main") or soup.find("article") or soup.find("body") or soup
    raw_text = main_elem.get_text(separator="\n")

    # Clean whitespace and multiple blank lines
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    clean_text = "\n\n".join(lines)

    return {
        "title": title,
        "url": url,
        "content": clean_text
    }
