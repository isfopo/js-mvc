// src/infrastructure/client/frame-styles.ts

/**
 * Parent-side style sharing module.
 * Extracts CSS text from the top-level page's already-parsed stylesheets
 * and sends it to child iframes so they can apply it via adoptedStyleSheets
 * instead of re-requesting and re-parsing the stylesheet.
 *
 * Strategy:
 * 1. Try to extract from document.styleSheets (zero network requests)
 * 2. Fall back to fetch() if cross-origin restrictions block access
 */

/** Cached CSS text extracted from the top-level page. */
let cachedCssText: string | null = null;

/**
 * Extract CSS text from the top-level page's stylesheets.
 * Uses document.styleSheets to avoid an extra network request.
 * Falls back to fetch() if cross-origin restrictions block access.
 */
async function getCssText(): Promise<string> {
  // Return cached text if available
  if (cachedCssText) return cachedCssText;

  // Try extracting from document.styleSheets first (zero network cost)
  try {
    const rules: string[] = [];
    for (const sheet of document.styleSheets) {
      try {
        // Accessing cssRules may throw if cross-origin
        const cssRules = sheet.cssRules;
        for (let i = 0; i < cssRules.length; i++) {
          rules.push(cssRules[i].cssText);
        }
      } catch {
        // Cross-origin stylesheet — skip it, we'll fetch it instead
        // or it's already handled by the <link> tag in the iframe
      }
    }

    if (rules.length > 0) {
      cachedCssText = rules.join("\n");
      return cachedCssText;
    }
  } catch {
    // document.styleSheets not accessible — fall through to fetch
  }

  // Fall back to fetching the CSS file
  try {
    const response = await fetch("/.generated/styles/index.css");
    if (!response.ok) {
      throw new Error(`Failed to fetch CSS: ${response.status}`);
    }
    cachedCssText = await response.text();
    return cachedCssText;
  } catch (e) {
    console.warn("[frame-styles] Failed to get CSS text:", e);
    throw e;
  }
}

/** Send CSS text to a child iframe via postMessage. */
function sendStylesToFrame(iframe: HTMLIFrameElement, cssText: string): void {
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: "frame:styles", cssText },
      "*", // TODO: restrict origin in production
    );
  }
}

/** Extract styles from the top-level page and share with the given iframe. */
export async function shareStylesWithFrame(
  iframe: HTMLIFrameElement,
): Promise<void> {
  try {
    const cssText = await getCssText();
    sendStylesToFrame(iframe, cssText);
  } catch (e) {
    console.warn("[frame-styles] Failed to share styles:", e);
    // Fallback: the iframe's <link> tag will fetch CSS normally
  }
}