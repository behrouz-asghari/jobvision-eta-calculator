// JobVision Navigation Calc - Content Script

(function () {
  "use strict";

  const STORAGE_KEY = "jv_nav_results";
  const PROCESSED_ATTR = "data-jv-nav-processed";

  // ========== Street Name Extraction ==========

  function extractStreetFromCard(jobCard) {
    // JobVision location pattern: "تهران ، آرژانتین" or "تهران ، بلوار کشاورز"
    // The street is the text after the last " ، " in the location span
    const locationSpans = jobCard.querySelectorAll("span");

    for (const span of locationSpans) {
      const text = span.textContent.trim();
      // Match Persian comma pattern: " ، "
      if (text.includes(" ، ")) {
        const parts = text.split(" ، ");
        const street = parts[parts.length - 1].trim();
        // Filter out empty or too-short names
        if (street && street.length > 1 && !street.match(/^\d/)) {
          return street;
        }
      }
    }
    return null;
  }

  function findAllJobCards() {
    // JobVision uses <job-card> custom elements or job card containers
    const cards = document.querySelectorAll("job-card");
    if (cards.length > 0) return Array.from(cards);

    // Fallback: look for job card links
    const links = document.querySelectorAll('a[href*="/jobs/"]');
    return Array.from(links).filter(a => a.closest(".jobs-list, .job-card-list"));
  }

  // ========== ETA Display ==========

  function getEtaColor(minutes) {
    if (minutes <= 15) return { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" };
    if (minutes <= 30) return { bg: "#fff8e1", text: "#f57f17", border: "#ffcc02" };
    return { bg: "#fce4ec", text: "#c62828", border: "#ef9a9a" };
  }

  function createEtaBadge(minutes, distanceKm) {
    const badge = document.createElement("span");
    badge.className = "jv-nav-eta-badge";
    const colors = getEtaColor(minutes);
    const timeText = minutes < 1 ? "کمتر از 1 دقیقه" : `${minutes} دقیقه`;
    const distText = distanceKm ? ` (${distanceKm} کیلومتر)` : "";

    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "600",
      marginRight: "6px",
      marginBottom: "4px",
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      whiteSpace: "nowrap",
      direction: "rtl",
    });

    badge.textContent = `🚗 ${timeText}${distText}`;
    return badge;
  }

  function createLoadingBadge() {
    const badge = document.createElement("span");
    badge.className = "jv-nav-loading-badge";
    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      marginRight: "6px",
      marginBottom: "4px",
      background: "#f3f3f3",
      color: "#999",
      border: "1px solid #e0e0e0",
      whiteSpace: "nowrap",
      animation: "jv-nav-pulse 1.5s infinite",
    });
    badge.textContent = "⏳ در حال محاسبه...";
    return badge;
  }

  function createErrorBadge() {
    const badge = document.createElement("span");
    badge.className = "jv-nav-error-badge";
    Object.assign(badge.style, {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      marginRight: "6px",
      marginBottom: "4px",
      background: "#f5f5f5",
      color: "#999",
      border: "1px solid #e0e0e0",
      whiteSpace: "nowrap",
    });
    badge.textContent = "❌ ناموفق";
    return badge;
  }

  function findLocationContainer(card) {
    // The location info is usually in a span with class containing "pointer-events-none"
    // or inside the job card grid area
    const spans = card.querySelectorAll("span");
    for (const span of spans) {
      if (span.textContent.includes(" ، ") && span.querySelector("a")) {
        return span;
      }
    }
    return null;
  }

  // ========== Caching ==========

  function getCachedResults() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function setCachedResult(streetName, result) {
    const cache = getCachedResults();
    cache[streetName] = result;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }

  // ========== Main Processing ==========

  async function processCard(card, originLat, originLng) {
    if (card.hasAttribute(PROCESSED_ATTR)) return;

    const street = extractStreetFromCard(card);
    if (!street) return;

    card.setAttribute(PROCESSED_ATTR, "true");

    // Check cache
    const cache = getCachedResults();
    if (cache[street]) {
      injectResult(card, cache[street]);
      return;
    }

    // Show loading
    const locationContainer = findLocationContainer(card);
    if (!locationContainer) return;

    const loadingBadge = createLoadingBadge();
    locationContainer.appendChild(loadingBadge);

    // Call background script
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "geocodeAndNavigate", streetName: street, originLat, originLng },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });

      // Remove loading badge
      loadingBadge.remove();

      if (result.error) {
        injectResult(card, { error: true });
        setCachedResult(street, { error: true });
      } else {
        injectResult(card, result);
        setCachedResult(street, result);
      }
    } catch (e) {
      loadingBadge.remove();
      injectResult(card, { error: true });
    }
  }

  function injectResult(card, result) {
    const locationContainer = findLocationContainer(card);
    if (!locationContainer) return;

    // Remove any existing badges
    locationContainer.querySelectorAll(".jv-nav-eta-badge, .jv-nav-error-badge").forEach(el => el.remove());

    if (result.error) {
      locationContainer.appendChild(createErrorBadge());
    } else {
      locationContainer.appendChild(createEtaBadge(result.minutes, result.distanceKm));
    }
  }

  // ========== Main Entry Point ==========

  async function main() {
    // Get origin from storage
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(["originLat", "originLng"], resolve);
    });

    if (!data.originLat || !data.originLng) {
      // No origin set - show message
      console.log("[JobVision Nav] Origin not set. Click extension icon to configure.");
      return;
    }

    const cards = findAllJobCards();
    console.log(`[JobVision Nav] Found ${cards.length} job cards`);

    // Process cards with small delay between each (rate limiting)
    for (let i = 0; i < cards.length; i++) {
      await processCard(cards[i], data.originLat, data.originLng);
      // Small delay to avoid hammering APIs
      if (i < cards.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // ========== Inject CSS ==========

  function injectStyles() {
    const fontRegular = chrome.runtime.getURL("fonts/Vazirmatn-Regular.woff2");
    const fontBold = chrome.runtime.getURL("fonts/Vazirmatn-Bold.woff2");

    const style = document.createElement("style");
    style.textContent = `
      @font-face {
        font-family: 'Vazirmatn';
        src: url('${fontRegular}') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Vazirmatn';
        src: url('${fontBold}') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
      @keyframes jv-nav-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .jv-nav-eta-badge, .jv-nav-loading-badge, .jv-nav-error-badge {
        font-family: 'Vazirmatn', sans-serif !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ========== MutationObserver for dynamic content ==========

  function observeChanges() {
    const observer = new MutationObserver((mutations) => {
      let hasNewCards = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.tagName === "JOB-CARD" || node.querySelector?.("job-card")) {
              hasNewCards = true;
              break;
            }
          }
        }
        if (hasNewCards) break;
      }
      if (hasNewCards) {
        // Re-process after a short delay
        setTimeout(main, 1000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ========== Init ==========

  injectStyles();

  // Wait for page to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(main, 2000);
      observeChanges();
    });
  } else {
    setTimeout(main, 2000);
    observeChanges();
  }
})();
