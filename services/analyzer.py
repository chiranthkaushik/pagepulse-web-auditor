"""
Website analysis service using Requests and BeautifulSoup4.
Provides URL validation, HTTP fetching, metrics extraction, and error handling.
"""

import time
import urllib.parse
from typing import Any, Dict, Optional, Tuple
import requests
from bs4 import BeautifulSoup


class AnalysisError(Exception):
    """Custom exception raised when webpage analysis fails."""

    def __init__(self, message: str, status_code: int = 400, title: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.title = title


def normalize_and_validate_url(raw_url: str) -> str:
    """
    Validates and normalizes the input URL.
    Prepends 'https://' if no scheme is specified.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise AnalysisError("Please enter a valid URL beginning with https://", status_code=400, title="Invalid URL")

    url_str = raw_url.strip()
    if not url_str:
        raise AnalysisError("URL parameter cannot be empty.", status_code=400, title="Invalid URL")

    # Automatically add https:// scheme if missing
    if not (url_str.startswith("http://") or url_str.startswith("https://")):
        url_str = "https://" + url_str

    try:
        parsed = urllib.parse.urlparse(url_str)
    except Exception:
        raise AnalysisError("Please enter a valid URL beginning with https://", status_code=400, title="Invalid URL")
    
    # Ensure netloc (domain) is present and scheme is http/https
    if not parsed.netloc or parsed.scheme not in ("http", "https"):
        raise AnalysisError(f"Invalid URL structure: '{raw_url}'. Please enter a valid URL beginning with https://", status_code=400, title="Invalid URL")

    # Basic hostname check
    if "." not in parsed.netloc and parsed.netloc != "localhost":
        raise AnalysisError(f"Invalid URL domain name: '{raw_url}'. Please enter a valid domain.", status_code=400, title="Invalid URL")

    return url_str


def extract_page_metrics(html_content: str) -> Tuple[str, str, int, int, int]:
    """
    Parses HTML content using BeautifulSoup and extracts key page audit metrics.
    Returns: (page_title, meta_description, h1_count, image_count, word_count)
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # 1. Page Title
    title_tag = soup.find("title")
    page_title = title_tag.get_text(strip=True) if title_tag and title_tag.get_text(strip=True) else "No title found"

    # 2. Meta Description
    meta_desc = None
    meta_tag = (
        soup.find("meta", attrs={"name": lambda v: v and v.lower() == "description"}) or
        soup.find("meta", attrs={"property": lambda v: v and v.lower() == "og:description"}) or
        soup.find("meta", attrs={"name": lambda v: v and v.lower() == "twitter:description"})
    )
    if meta_tag and meta_tag.get("content"):
        meta_desc = meta_tag.get("content", "").strip()

    meta_description = meta_desc if meta_desc else "No meta description found"

    # 3. H1 Heading Count
    h1_count = len(soup.find_all("h1"))

    # 4. Image Count
    all_images = soup.find_all("img")
    image_count = len(all_images)
    images_missing_alt = len([img for img in all_images if not img.get("alt", "").strip()])

    # 5. Word Count (Extract text excluding scripts/styles/metadata)
    for element in soup(["script", "style", "noscript", "svg", "header", "footer", "nav"]):
        element.decompose()

    body_text = soup.get_text(separator=" ", strip=True)
    words = [word for word in body_text.split() if word.strip()]
    word_count = len(words)

    return page_title, meta_description, h1_count, image_count, images_missing_alt, word_count


def analyze_url(raw_url: str, timeout_seconds: float = 10.0) -> Dict[str, Any]:
    """
    Main entry point for analyzing a URL.
    Fetches webpage, measures response time, extracts metrics, and handles errors.
    
    Returns a dictionary conforming to the required API contract:
    {
        "status": 200,
        "response_time_ms": int,
        "page_title": str,
        "meta_description": str,
        "h1_count": int,
        "image_count": int,
        "word_count": int
    }
    """
    validated_url = normalize_and_validate_url(raw_url)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 PagePulseAudit/1.0"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    start_time = time.perf_counter()

    try:
        response = requests.get(
            validated_url,
            headers=headers,
            timeout=timeout_seconds,
            allow_redirects=True,
        )
        end_time = time.perf_counter()
        response_time_ms = int(round((end_time - start_time) * 1000))

    except requests.exceptions.Timeout:
        raise AnalysisError(
            f"Request timed out after {timeout_seconds} seconds.",
            status_code=504,
            title="Request Timed Out"
        )

    except requests.exceptions.SSLError as e:
        raise AnalysisError(
            f"SSL Certificate verification failed for URL: {validated_url}",
            status_code=502,
            title="SSL Certificate Error"
        )

    except requests.exceptions.TooManyRedirects:
        raise AnalysisError(
            f"Too many redirects encountered while attempting to fetch URL: {validated_url}",
            status_code=502,
            title="Redirect Loop Error"
        )

    except (requests.exceptions.InvalidURL, requests.exceptions.URLRequired):
        raise AnalysisError(
            f"Invalid URL provided: {validated_url}. Please enter a valid URL beginning with https://",
            status_code=400,
            title="Invalid URL"
        )

    except requests.exceptions.ConnectionError as e:
        raise AnalysisError(
            f"DNS resolution failure or host unreachable: Unable to resolve host for URL '{validated_url}'.",
            status_code=502,
            title="DNS Resolution Failure"
        )

    except requests.exceptions.RequestException as e:
        raise AnalysisError(
            f"An HTTP request error occurred while fetching the URL: {str(e)}",
            status_code=502,
            title="Connection Error"
        )

    # Check for HTTP status code errors (e.g., 404, 500)
    if response.status_code == 404:
        raise AnalysisError(
            "HTTP 404 Not Found: The requested page could not be found on target server.",
            status_code=404,
            title="404 Not Found"
        )

    if response.status_code >= 500:
        raise AnalysisError(
            f"HTTP {response.status_code} Internal Server Error: Target server returned an error.",
            status_code=response.status_code,
            title="Server Error"
        )

    if response.status_code >= 400:
        raise AnalysisError(
            f"Target server returned HTTP status code {response.status_code} ({response.reason or 'Error'}).",
            status_code=response.status_code,
            title=f"HTTP {response.status_code} Error"
        )

    # Inspect Content-Type before parsing HTML
    content_type = response.headers.get("Content-Type", "").lower()
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
        raise AnalysisError(
            "This URL points to a PDF, image, or other non-HTML resource and cannot be analyzed as a webpage.",
            status_code=400,
            title="Non-HTML Content"
        )

    # Parse HTML metrics
    try:
        page_title, meta_description, h1_count, image_count, images_missing_alt, word_count = extract_page_metrics(response.text)
    except Exception as e:
        raise AnalysisError(f"Failed to parse webpage HTML content: {str(e)}", status_code=500)

    return {
        "status": response.status_code,
        "response_time_ms": response_time_ms,
        "page_title": page_title,
        "meta_description": meta_description,
        "h1_count": h1_count,
       "image_count": image_count,
       "images_missing_alt": images_missing_alt,
       "word_count": word_count,
    }
