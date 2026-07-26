/**
 * Page Pulse - Web Audit Tool Frontend JavaScript
 * Handles DOM interaction, URL validation, API requests, state rendering, theme switching,
 * rotating loading states, copy formatted JSON with toast notification, and responsive UX.
 */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // DOM Element References
    // ----------------------------------------------------------------------
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeMoonIcon = document.getElementById("theme-moon-icon");
    const themeSunIcon = document.getElementById("theme-sun-icon");

    const heroSection = document.getElementById("hero-section");
    const auditForm = document.getElementById("url-audit-form");
    const urlInput = document.getElementById("url-input");
    const clearInputBtn = document.getElementById("clear-input-btn");
    const analyzeBtn = document.getElementById("analyze-btn");
    const validationWarning = document.getElementById("input-validation-msg");
    const validationMsgText = document.getElementById("validation-msg-text");

    const emptyState = document.getElementById("empty-state");
    const loadingState = document.getElementById("loading-state");
    const loadingMessageText = document.getElementById("loading-message-text");

    const errorBanner = document.getElementById("error-banner");
    const errorTitle = document.getElementById("error-title");
    const errorDescription = document.getElementById("error-description");
    const dismissErrorBtn = document.getElementById("dismiss-error-btn");

    const resultsSection = document.getElementById("results-section");
    const analysisDurationText = document.getElementById("analysis-duration-text");
    const targetUrlDisplay = document.getElementById("target-url-display");
    const copyJsonBtn = document.getElementById("copy-json-btn");
    const copyBtnText = document.getElementById("copy-btn-text");
    const resetAuditBtn = document.getElementById("reset-audit-btn");

    // Metric Value & Badge Elements
    const valHttpStatus = document.getElementById("val-http-status");
    const badgeHttpStatus = document.getElementById("badge-http-status");
    const footnoteHttpStatus = document.getElementById("footnote-http-status");

    const valResponseTime = document.getElementById("val-response-time");
    const badgeResponseTime = document.getElementById("badge-response-time");
    const footnoteResponseTime = document.getElementById("footnote-response-time");

    const pageFaviconImg = document.getElementById("page-favicon-img");
    const pageFaviconFallback = document.getElementById("page-favicon-fallback");
    const valPageTitle = document.getElementById("val-page-title");
    const valMetaDesc = document.getElementById("val-meta-desc");

    const valH1Count = document.getElementById("val-h1-count");
    const valImageCount = document.getElementById("val-image-count");
    const valWordCount = document.getElementById("val-word-count");

    // State variables
    let currentAuditData = null;
    let loadingInterval = null;
    let loadingMsgIndex = 0;

    const loadingMessages = [
        "Scanning website...",
        "Fetching HTML...",
        "Extracting metadata...",
        "Counting headings...",
        "Calculating statistics...",
        "Preparing report..."
    ];

    // ----------------------------------------------------------------------
    // 1. Dark / Light Theme Manager
    // ----------------------------------------------------------------------
    function initTheme() {
        const savedTheme = localStorage.getItem("pagepulse_theme") || "dark";
        setTheme(savedTheme);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("pagepulse_theme", theme);

        if (theme === "dark") {
            themeMoonIcon.classList.remove("hidden");
            themeSunIcon.classList.add("hidden");
        } else {
            themeMoonIcon.classList.add("hidden");
            themeSunIcon.classList.remove("hidden");
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            setTheme(currentTheme === "dark" ? "light" : "dark");
        });
    }

    initTheme();

    // ----------------------------------------------------------------------
    // 2. Client-side URL Input Handling & Validation
    // ----------------------------------------------------------------------
    urlInput.addEventListener("input", () => {
        const value = urlInput.value.trim();
        if (value.length > 0) {
            clearInputBtn.classList.remove("hidden");
        } else {
            clearInputBtn.classList.add("hidden");
        }
        hideValidationWarning();
    });

    clearInputBtn.addEventListener("click", () => {
        urlInput.value = "";
        clearInputBtn.classList.add("hidden");
        hideValidationWarning();
        urlInput.focus();
    });

    // Enter Key Trigger
    urlInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            auditForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
    });

    function showValidationWarning(message) {
        validationMsgText.textContent = message || "Please enter a valid URL.";
        validationWarning.classList.remove("hidden");
    }

    function hideValidationWarning() {
        validationWarning.classList.add("hidden");
    }

    function isValidUrlInput(rawInput) {
        if (!rawInput || rawInput.trim().length === 0) {
            showValidationWarning("URL cannot be empty.");
            return false;
        }

        let input = rawInput.trim();
        if (!input.startsWith("http://") && !input.startsWith("https://")) {
            input = "https://" + input;
        }

        try {
            const parsed = new URL(input);
            if (!parsed.hostname || parsed.hostname.length < 3) {
                showValidationWarning("Please enter a valid website hostname (e.g. example.com).");
                return false;
            }
            if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
                showValidationWarning("Domain name must include a valid TLD (e.g., .com, .org).");
                return false;
            }
            hideValidationWarning();
            return input;
        } catch (e) {
            showValidationWarning("Please enter a valid URL beginning with https://");
            return false;
        }
    }

    // ----------------------------------------------------------------------
    // 3. Form Submission & API Fetching
    // ----------------------------------------------------------------------
    auditForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideErrorBanner();
        hideValidationWarning();

        const rawUrl = urlInput.value.trim();
        const validatedUrl = isValidUrlInput(rawUrl);

        if (!validatedUrl) {
            return;
        }

        // Show loading state and hide empty state/results
        setLoadingState(true);
        if (emptyState) emptyState.classList.add("hidden");
        resultsSection.classList.add("hidden");

        const startTime = performance.now();

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: validatedUrl })
            });

            const data = await response.json();
            const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

            if (!response.ok || data.error) {
                showFormattedError(data.error || `Server returned HTTP status ${response.status}`, response.status, data.title);
                setLoadingState(false);
                if (emptyState) emptyState.classList.remove("hidden");
                return;
            }

            // Successfully received analysis metrics
            currentAuditData = data;
            renderResults(validatedUrl, data, elapsedSec);
            setLoadingState(false);

            // Automatically reduce hero height after first successful analysis
            if (heroSection) heroSection.classList.add("compact-hero");

        } catch (error) {
            setLoadingState(false);
            if (emptyState) emptyState.classList.remove("hidden");
            showFormattedError("Unable to resolve host or establish connection to URL.", 502);
        }
    });

    // ----------------------------------------------------------------------
    // 4. Rotating Loading State Animation
    // ----------------------------------------------------------------------
    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingState.classList.remove("hidden");
            analyzeBtn.disabled = true;
            analyzeBtn.style.opacity = "0.7";
            urlInput.disabled = true;
            startRotatingLoadingMessages();
        } else {
            loadingState.classList.add("hidden");
            analyzeBtn.disabled = false;
            analyzeBtn.style.opacity = "1";
            urlInput.disabled = false;
            stopRotatingLoadingMessages();
        }
    }

    function startRotatingLoadingMessages() {
        loadingMsgIndex = 0;
        if (loadingMessageText) loadingMessageText.textContent = loadingMessages[0];

        clearInterval(loadingInterval);
        loadingInterval = setInterval(() => {
            loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
            if (loadingMessageText) {
                loadingMessageText.style.opacity = "0";
                setTimeout(() => {
                    loadingMessageText.textContent = loadingMessages[loadingMsgIndex];
                    loadingMessageText.style.opacity = "1";
                }, 150);
            }
        }, 1000);
    }

    function stopRotatingLoadingMessages() {
        clearInterval(loadingInterval);
    }

    // ----------------------------------------------------------------------
    // 5. Error Banner Formatting
    // ----------------------------------------------------------------------
    function showFormattedError(rawMessage, statusCode, apiTitle) {
        const msg = (rawMessage || "").toLowerCase();
        let title = "⚠ Analysis Failed";
        let description = rawMessage || "An error occurred while analyzing the provided URL.";

        if (apiTitle === "Non-HTML Content" || msg.includes("non-html") || msg.includes("pdf") || msg.includes("image") || msg.includes("html webpage") || msg.includes("content type") || msg.includes("cannot be analyzed as a webpage")) {
            title = "🌐 Non HTML Content";
            description = rawMessage || "This URL points to a PDF, image, or other non-HTML resource and cannot be analyzed as a webpage.";
        } else if (apiTitle === "Invalid URL" || msg.includes("invalid url") || msg.includes("scheme") || msg.includes("domain name") || (statusCode === 400 && msg.includes("url"))) {
            title = "⚠ Invalid URL";
            description = "Please enter a valid URL beginning with https://";
        } else if (apiTitle === "Request Timed Out" || msg.includes("timed out") || msg.includes("timeout") || statusCode === 504) {
            title = "⏱ Request Timed Out";
            description = "The website took too long to respond.";
        } else if (apiTitle === "SSL Certificate Error" || msg.includes("ssl") || msg.includes("certificate")) {
            title = "🔒 SSL Verification Error";
            description = "SSL Certificate verification failed for this URL.";
        } else if (apiTitle === "Redirect Loop Error" || msg.includes("redirect")) {
            title = "🔄 Too Many Redirects";
            description = "The target website encountered a redirect loop.";
        } else if (apiTitle === "DNS Resolution Failure" || msg.includes("unable to resolve host") || msg.includes("dns") || msg.includes("connection") || statusCode === 502) {
            title = "🔌 Connection Error";
            description = "Unable to resolve host or connect to the target server.";
        } else if (statusCode === 404 || apiTitle === "404 Not Found" || msg.includes("404")) {
            title = "🟠 404 Not Found";
            description = "The requested page could not be found on the target server.";
        } else if (statusCode >= 500) {
            title = "🔴 Server Error";
            description = "Target server returned an internal server error.";
        } else if (apiTitle) {
            title = `⚠ ${apiTitle}`;
        }

        errorTitle.textContent = title;
        errorDescription.textContent = description;
        errorBanner.classList.remove("hidden");
        errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function hideErrorBanner() {
        errorBanner.classList.add("hidden");
    }

    if (dismissErrorBtn) dismissErrorBtn.addEventListener("click", hideErrorBanner);

    // ----------------------------------------------------------------------
    // 6. UI Rendering Functions
    // ----------------------------------------------------------------------
    function escapeHtml(str) {
        return (str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderResults(url, data, elapsedSec) {
        // Analysis completed duration display
        if (analysisDurationText) {
            analysisDurationText.textContent = `✓ Analysis completed in ${elapsedSec} seconds`;
        }

        // Clickable URL Display with external link icon
        if (targetUrlDisplay) {
            targetUrlDisplay.href = url;
            targetUrlDisplay.innerHTML = `
                <span>${escapeHtml(url)}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline-ext-icon">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            `;
        }

        // 1. HTTP Status Card
        const status = data.status || 200;
        if (status === 200) {
            valHttpStatus.textContent = "200 OK";
            badgeHttpStatus.textContent = "🟢 200 OK";
            badgeHttpStatus.className = "status-pill pill-success";
            if (footnoteHttpStatus) footnoteHttpStatus.textContent = "Healthy Response";
        } else if (status === 404) {
            valHttpStatus.textContent = "404 Not Found";
            badgeHttpStatus.textContent = "🟠 404 Not Found";
            badgeHttpStatus.className = "status-pill pill-moderate";
            if (footnoteHttpStatus) footnoteHttpStatus.textContent = "Resource Not Found";
        } else if (status >= 500) {
            valHttpStatus.textContent = `${status} Error`;
            badgeHttpStatus.textContent = `🔴 ${status} Server Error`;
            badgeHttpStatus.className = "status-pill pill-slow";
            if (footnoteHttpStatus) footnoteHttpStatus.textContent = "Internal Server Error";
        } else {
            valHttpStatus.textContent = `${status} Status`;
            badgeHttpStatus.textContent = `🟠 ${status} Code`;
            badgeHttpStatus.className = "status-pill pill-moderate";
            if (footnoteHttpStatus) footnoteHttpStatus.textContent = "Server Response Code";
        }

        // 2. Response Time Card
        const respTime = data.response_time_ms !== undefined ? data.response_time_ms : 0;
        valResponseTime.innerHTML = `${respTime} <span class="unit">ms</span>`;
        if (respTime < 150) {
            badgeResponseTime.textContent = "Excellent";
            badgeResponseTime.className = "status-pill pill-fast";
        } else if (respTime < 400) {
            badgeResponseTime.textContent = "Good";
            badgeResponseTime.className = "status-pill pill-success";
        } else if (respTime < 750) {
            badgeResponseTime.textContent = "Moderate";
            badgeResponseTime.className = "status-pill pill-moderate";
        } else {
            badgeResponseTime.textContent = "Slow";
            badgeResponseTime.className = "status-pill pill-slow";
        }

        // 3. Page Title & Favicon
        valPageTitle.textContent = data.page_title || "No title found";
        
        // Fetch and display website Favicon
        try {
            const domain = new URL(url).hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
            
            pageFaviconImg.onerror = () => {
                pageFaviconImg.classList.add("hidden");
                pageFaviconFallback.classList.remove("hidden");
            };
            pageFaviconImg.onload = () => {
                pageFaviconImg.classList.remove("hidden");
                pageFaviconFallback.classList.add("hidden");
            };
            pageFaviconImg.src = faviconUrl;
        } catch (e) {
            pageFaviconImg.classList.add("hidden");
            pageFaviconFallback.classList.remove("hidden");
        }

        // 4. Meta Description
        valMetaDesc.textContent = data.meta_description || "No meta description found";

        // 5. H1 Count
        const h1s = (data.h1_count !== undefined) ? data.h1_count : 0;
        valH1Count.textContent = `${h1s} ${h1s === 1 ? "Heading" : "Headings"}`;

        // 6. Image Count
        const images = (data.image_count !== undefined) ? data.image_count : 0;
        valImageCount.textContent = `${images} ${images === 1 ? "Image" : "Images"}`;

        // 7. Word Count
        const words = (data.word_count !== undefined) ? data.word_count : 0;
        valWordCount.textContent = `${words.toLocaleString()} Words`;

        // Reveal results area with smooth scroll
        if (emptyState) emptyState.classList.add("hidden");
        resultsSection.classList.remove("hidden");
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ----------------------------------------------------------------------
    // 7. Copy Formatted JSON & Toast Notification
    // ----------------------------------------------------------------------
    function showToast(message) {
        const toast = document.getElementById("toast-notification");
        const toastMsg = document.getElementById("toast-message");
        if (!toast || !toastMsg) return;

        toastMsg.textContent = message || "Copied successfully.";
        toast.classList.remove("hidden");
        toast.classList.add("toast-show");

        setTimeout(() => {
            toast.classList.remove("toast-show");
            setTimeout(() => {
                toast.classList.add("hidden");
            }, 300);
        }, 2200);
    }

    if (copyJsonBtn) {
        copyJsonBtn.addEventListener("click", () => {
            if (!currentAuditData) return;

            const formattedJson = JSON.stringify(currentAuditData, null, 2);
            navigator.clipboard.writeText(formattedJson).then(() => {
                showToast("Copied successfully.");
            }).catch(() => {
                // Fallback for clipboard API restrictions
                const textarea = document.createElement("textarea");
                textarea.value = formattedJson;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
                showToast("Copied successfully.");
            });
        });
    }

    if (resetAuditBtn) {
        resetAuditBtn.addEventListener("click", () => {
            urlInput.value = "";
            currentAuditData = null;
            clearInputBtn.classList.add("hidden");
            hideValidationWarning();
            hideErrorBanner();
            resultsSection.classList.add("hidden");
            if (emptyState) emptyState.classList.remove("hidden");
            if (heroSection) heroSection.classList.remove("compact-hero");
            window.scrollTo({ top: 0, behavior: "smooth" });
            urlInput.focus();
        });
    }
});
