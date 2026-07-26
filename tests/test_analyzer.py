"""
Unit tests for the Page Pulse analyzer service and Flask API endpoints.
Tests cover valid URL analysis, invalid URLs, timeouts, and API responses.
"""

from unittest.mock import MagicMock, patch
import pytest
import requests

from services.analyzer import (
    AnalysisError,
    analyze_url,
    extract_page_metrics,
    normalize_and_validate_url,
)
from app import app


# ==========================================
# Unit Tests for URL Normalization & Validation
# ==========================================

def test_normalize_url_valid():
    """Test normalizing and validating correct URLs."""
    assert normalize_and_validate_url("example.com") == "https://example.com"
    assert normalize_and_validate_url("http://example.com/page") == "http://example.com/page"
    assert normalize_and_validate_url("https://sub.domain.org") == "https://sub.domain.org"


def test_normalize_url_invalid():
    """Test that invalid URLs raise AnalysisError with 400 status."""
    with pytest.raises(AnalysisError) as exc_info:
        normalize_and_validate_url("")
    assert exc_info.value.status_code == 400

    with pytest.raises(AnalysisError) as exc_info:
        normalize_and_validate_url("not_a_valid_url")
    assert exc_info.value.status_code == 400

    with pytest.raises(AnalysisError) as exc_info:
        normalize_and_validate_url("ftp://invalid-scheme.com")
    assert exc_info.value.status_code == 400


# ==========================================
# Unit Tests for HTML Parsing Metrics
# ==========================================

def test_extract_page_metrics():
    """Test extracting metrics from sample HTML string."""
    sample_html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page Title</title>
        <meta name="description" content="This is a test meta description for Page Pulse." />
      </head>
      <body>
        <h1>Primary Heading</h1>
        <h1>Secondary Heading</h1>
        <p>This is paragraph text with seven words total.</p>
        <img src="logo.png" alt="Logo" />
        <img src="hero.jpg" alt="Hero Image" />
        <script>var x = 100;</script>
      </body>
    </html>
    """
    title, desc, h1_count, img_count, word_count = extract_page_metrics(sample_html)

    assert title == "Test Page Title"
    assert desc == "This is a test meta description for Page Pulse."
    assert h1_count == 2
    assert img_count == 2
    assert word_count > 0


# ==========================================
# Unit Tests for analyze_url (Service Layer)
# ==========================================

@patch("services.analyzer.requests.get")
def test_analyze_url_valid(mock_get):
    """Test analyzing a valid URL with mocked successful response."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"Content-Type": "text/html; charset=utf-8"}
    mock_response.text = """
    <html>
      <head>
        <title>Example Domain</title>
        <meta name="description" content="Example domain meta tag description." />
      </head>
      <body>
        <h1>Example Domain</h1>
        <p>This domain is for use in illustrative examples in documents.</p>
        <img src="example.png" />
      </body>
    </html>
    """
    mock_get.return_value = mock_response

    result = analyze_url("https://example.com")

    assert result["status"] == 200
    assert result["page_title"] == "Example Domain"
    assert result["meta_description"] == "Example domain meta tag description."
    assert result["h1_count"] == 1
    assert result["image_count"] == 1
    assert result["word_count"] > 0
    assert "response_time_ms" in result
    assert isinstance(result["response_time_ms"], int)


@patch("services.analyzer.requests.get")
def test_analyze_url_timeout(mock_get):
    """Test handling of request timeout."""
    mock_get.side_effect = requests.exceptions.Timeout("Request timed out.")

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://slow-website-example.com")

    assert exc_info.value.status_code == 504
    assert "timed out" in exc_info.value.message.lower()


@patch("services.analyzer.requests.get")
def test_analyze_url_connection_error(mock_get):
    """Test handling of connection or DNS resolution failure."""
    mock_get.side_effect = requests.exceptions.ConnectionError("Failed to connect.")

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://unreachable-dns-domain-999.com")

    assert exc_info.value.status_code == 502
    assert "unable to resolve host" in exc_info.value.message.lower()


@patch("services.analyzer.requests.get")
def test_analyze_url_non_html(mock_get):
    """Test handling of non-HTML responses (e.g. PDF/image/JSON)."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"Content-Type": "application/pdf"}
    mock_get.return_value = mock_response

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://example.com/document.pdf")

    assert exc_info.value.status_code == 400
    assert exc_info.value.title == "Non-HTML Content"
    assert "non-html resource" in exc_info.value.message.lower()


@patch("services.analyzer.requests.get")
def test_analyze_url_ssl_error(mock_get):
    """Test handling of SSL verification error."""
    mock_get.side_effect = requests.exceptions.SSLError("SSL verification failed.")

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://invalid-ssl-site.com")

    assert exc_info.value.status_code == 502
    assert exc_info.value.title == "SSL Certificate Error"


@patch("services.analyzer.requests.get")
def test_analyze_url_http_404(mock_get):
    """Test handling of HTTP 404 Not Found."""
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_get.return_value = mock_response

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://example.com/nonexistent")

    assert exc_info.value.status_code == 404
    assert exc_info.value.title == "404 Not Found"


@patch("services.analyzer.requests.get")
def test_analyze_url_http_500(mock_get):
    """Test handling of HTTP 500 Internal Server Error."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_get.return_value = mock_response

    with pytest.raises(AnalysisError) as exc_info:
        analyze_url("https://example.com/error")

    assert exc_info.value.status_code == 500
    assert exc_info.value.title == "Server Error"


# ==========================================
# Flask API Endpoint Tests (Integration)
# ==========================================

@pytest.fixture
def client():
    """Flask test client fixture."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@patch("app.analyze_url")
def test_api_analyze_success(mock_analyze_url, client):
    """Test POST /api/analyze endpoint returning 200 success."""
    mock_analyze_url.return_value = {
        "status": 200,
        "response_time_ms": 153,
        "page_title": "Example Title",
        "meta_description": "Sample description",
        "h1_count": 1,
        "image_count": 5,
        "word_count": 350,
    }

    response = client.post("/api/analyze", json={"url": "https://example.com"})
    data = response.get_json()

    assert response.status_code == 200
    assert data["status"] == 200
    assert data["response_time_ms"] == 153
    assert data["page_title"] == "Example Title"
    assert data["meta_description"] == "Sample description"
    assert data["h1_count"] == 1
    assert data["image_count"] == 5
    assert data["word_count"] == 350


def test_api_analyze_missing_url(client):
    """Test POST /api/analyze without 'url' in body."""
    response = client.post("/api/analyze", json={})
    data = response.get_json()

    assert response.status_code == 400
    assert "error" in data
    assert "required" in data["error"].lower()


@patch("app.analyze_url")
def test_api_analyze_timeout_endpoint(mock_analyze_url, client):
    """Test POST /api/analyze when analyzer service raises timeout exception."""
    mock_analyze_url.side_effect = AnalysisError("Request timed out after 10.0 seconds.", status_code=504)

    response = client.post("/api/analyze", json={"url": "https://timeout-site.com"})
    data = response.get_json()

    assert response.status_code == 504
    assert data["status"] == 504
    assert "error" in data
    assert "timed out" in data["error"].lower()
