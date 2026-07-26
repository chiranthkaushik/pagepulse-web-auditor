# Page Pulse ⚡

> **Page Pulse** is a professional, high-performance website audit tool built with Python, Flask, BeautifulSoup4, and vanilla HTML/CSS/JS. It audits any website URL in real-time, measuring response speed and extracting critical structural and SEO webpage information.

---
## Live Demo
https://pagepulse-web-auditor.onrender.com

## 🎥 Loom Walkthrough

[Watch the Loom Walkthrough](https://www.loom.com/share/2311b4158f9941bcbd885d1f894cc32e)

## 📖 Table of Contents
- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [API Contract](#-api-contract)
- [Folder Structure](#-folder-structure)
- [Installation & Setup](#-installation--setup)
- [How to Run](#-how-to-run)
- [Testing Suite](#-testing-suite)
- [Deployment (Render)](#-deployment-render)
- [Three Key Design Decisions](#-three-key-design-decisions)
- [Future Improvements](#-future-improvements)
- [AI Usage Statement](#-ai-usage-statement)

---

## 🎯 Project Overview
Page Pulse addresses the need for quick, actionable, lightweight website health and SEO audits without overhead or complex tracking setups. Given any target URL, the backend performs a real-time HTTP probe, measures latency, parses the DOM payload, and returns structured metrics:
- HTTP Status Code & Health
- Response Time Latency (milliseconds)
- `<title>` Tag Contents
- `<meta name="description">` SEO Tag Contents
- `<h1>` Heading Tag Frequency
- Image Tag Frequency (`<img>`)
- Approximate Word Count of Visible Text

---

## ✨ Key Features
- **Instant Web Audit Engine**: Fast non-blocking HTTP requests with custom User-Agent headers to avoid bot blocks.
- **Resilient Error Handling**: Gracefully handles timeouts, DNS resolution failures, invalid schemas, SSL errors, non-HTML content, and 4xx/5xx target site responses without server crashes.
- **Modern Glassmorphic Frontend**: Responsive pure CSS interface (Zero Tailwind/Bootstrap dependencies) featuring backdrop blur filters, rounded cards, and smooth micro-interactions.
- **Dark & Light Mode Support**: Seamless theme toggling with automated local storage persistence.
- **Client-Side Validation**: Instant regex and URL parsing checks before dispatching API calls.
- **Copy JSON & Audit Reset**: One-click JSON exporter for audit results and reset control.
- **Built for Digital Heroes Training Task**: Includes link attribution to [Digital Heroes](https://digitalheroesco.com).

---

## 🔌 API Contract

### **POST /api/analyze**

#### **Request Header:**
`Content-Type: application/json`

#### **Request Payload (JSON):**
```json
{
  "url": "https://example.com"
}
```

#### **Success Response (200 OK):**
```json
{
  "status": 200,
  "response_time_ms": 153,
  "page_title": "Example Domain",
  "meta_description": "This domain is for use in illustrative examples in documents.",
  "h1_count": 1,
  "image_count": 0,
  "images_missing_alt": 0,
  "word_count": 156
}
```

#### **Error Response (400 / 502 / 504):**
```json
{
  "error": "Request timed out after 10.0 seconds.",
  "status": 504
}
```

---

## 📁 Folder Structure

```
page-pulse/
├── app.py                      # Main Flask application & REST API routes
├── requirements.txt            # Python production & testing dependencies
├── README.md                   # Complete documentation
├── .gitignore                  # Source control ignore rules
├── services/
│   ├── __init__.py             # Service package marker
│   └── analyzer.py             # Business logic: URL validation, Requests, & BS4 parser
├── templates/
│   └── index.html              # Modern glassmorphism HTML layout
├── static/
│   ├── style.css               # Pure CSS styling, animations, and dark/light theme
│   └── script.js               # Vanilla JS DOM interactions, fetch API, theme toggler
└── tests/
    ├── __init__.py             # Tests package marker
    └── test_analyzer.py        # Pytest suite for valid URL, invalid URL, and timeout cases
```

---

## ⚙️ Installation & Setup

### **Prerequisites**
- Python 3.9+
- `pip` (Python package manager)

### **1. Clone or Extract Repository**
```bash
cd page-pulse
```

### **2. Create & Activate Virtual Environment**
```bash
# On Linux / macOS
python3 -m venv venv
source venv/bin/venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate
```

### **3. Install Dependencies**
```bash
pip install -r requirements.txt
```

---

## 🚀 How to Run

### **Run Locally with Flask Development Server**
```bash
python3 app.py
```
Open your browser and navigate to `http://localhost:3000` (or `http://127.0.0.1:3000`).

### **Run Production Server with Gunicorn**
```bash
gunicorn --bind 0.0.0.0:3000 app:app
```

---

## 🧪 Testing Suite

The project includes unit and integration tests using `pytest` covering:
1. **Valid URL Analysis**: Mocking HTTP responses to verify metric calculations (`response_time_ms`, `h1_count`, `image_count`, `word_count`).
2. **Invalid URL Input**: Validating URL schemes, malformed domain strings, and missing input handling.
3. **Timeout Exceptions**: Ensuring `requests.exceptions.Timeout` returns HTTP status `504` with clean JSON error messages.

### **Run Tests**
```bash
pytest -v
```

---

## ☁️ Deployment (Render)

This application is designed for seamless deployment on **Render** (or any Cloud container platform like Google Cloud Run / Heroku).

### **Render Deployment Instructions:**

1. **Connect Repository**: Push your code to a GitHub or GitLab repository.
2. **Create New Web Service**: Log into [Render Dashboard](https://dashboard.render.com) -> Click **New +** -> Select **Web Service**.
3. **Configure Service Settings**:
   - **Name**: `page-pulse`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Port**: Render automatically detects and binds `PORT` (or defaults to `3000`).
4. **Deploy**: Click **Create Web Service**. Render will install dependencies, build the service, and serve Page Pulse globally with free HTTPS SSL certificates.

---

## 📐 Three Key Design Decisions

1. **Modular Architecture & Service Separation**:
   Business logic (`services/analyzer.py`) is completely decoupled from HTTP web route routing (`app.py`). This ensures high maintainability, unit testability without running web servers, and strict error boundaries.

2. **Zero-Dependency Native Frontend**:
   Rather than introducing bloated UI libraries like Bootstrap or build tools like Tailwind, the frontend uses native CSS variables, glassmorphic backdrop filters, CSS Grid, and vanilla ES6 JavaScript. This yields sub-millisecond frontend load times and eliminates build-step friction.

3. **Defensive Probe Engineering & Anti-Crash Middleware**:
   Target websites frequently block standard bot headers or return unexpected binaries (images, PDFs). Page Pulse includes explicit browser `User-Agent` emulation, HTML `Content-Type` verification, SSL fallback checks, and catch-all exception wrappers to ensure the backend server never crashes under any network condition.

---

## 🔮 Future Improvements
- **Lighthouse / Core Web Vitals Integration**: Incorporate Google PageSpeed Insights API for CLS, LCP, and FID performance scores.
- **Broken Link Checker**: Recursively crawl internal links and report `404` dead links.
- **PDF Audit Report Export**: Allow users to download printable PDF performance reports.
- **Historical Comparison**: Cache prior URL audits to display performance trends over time.

---

## 🤖 AI Usage Statement

This project was developed with assistance from Google DeepMind's Gemini models in Google AI Studio. AI was utilized for:
- Drafting boilerplate Flask routes and modular service structures.
- Crafting mock test assertions for `pytest`.
- Refining glassmorphism CSS variable palettes and responsive layout styling.
All AI-generated suggestions were thoroughly audited, tested, and validated for security, functional compliance, and performance.
