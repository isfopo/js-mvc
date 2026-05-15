// src/infrastructure/client/frame-styles.ts

/**
 * Parent-side style sharing module.
 * Fetches the CSS file and sends its text to child iframes
 * so they can apply it via adoptedStyleSheets instead of
 * re-requesting and re-parsing the stylesheet.
 */

const CSS_PATH = "/.generated/styles/index.css";

/** Fetch the CSS file and return its text. */
async function fetchCssText(): Promise<string> {
  const response = await fetch(CSS_PATH);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSS: ${response.status}`);
  }
  return response.text();
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

/** Fetch and share styles with the given iframe. */
export async function shareStylesWithFrame(
  iframe: HTMLIFrameElement,
): Promise<void> {
  try {
    const cssText = await fetchCssText();
    sendStylesToFrame(iframe, cssText);
  } catch (e) {
    console.warn("[frame-styles] Failed to share styles:", e);
    // Fallback: the iframe's <link> tag will fetch CSS normally
  }
}