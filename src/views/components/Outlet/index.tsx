// src/views/components/Outlet/index.tsx

import type { FC } from "hono/jsx";
import { getFramePath, getFrameDepth } from "infrastructure/FrameContext";

interface OutletProps {
  /** Override the path for this outlet. Used for multi-outlet layouts (Phase 4). */
  path?: string;
  /** Named outlet — becomes the iframe name attribute. Defaults to "frame-{depth}". */
  name?: string;
}

/**
 * Outlet renders as an <iframe> pointing to the same path at the next depth.
 *
 * Only used in views that have visual chrome surrounding child content.
 * Views without surrounding chrome render content directly (no Outlet).
 *
 * scrolling="no" prevents the iframe from having its own scrollbar.
 * The iframe height is set dynamically by frame:resize (frame-child.ts
 * reports content height, frame-router.ts sets iframe.style.height),
 * so the outer page scrolls instead of the iframe.
 */
export const Outlet: FC<OutletProps> = ({ path, name }) => {
  const outletPath = path ?? getFramePath();
  const outletDepth = getFrameDepth() + 1;

  // Build the iframe src: same path with _depth incremented
  const src = outletPath.includes("?")
    ? `${outletPath}&_depth=${outletDepth}`
    : `${outletPath}?_depth=${outletDepth}`;

  const frameName = name ?? `frame-${outletDepth}`;

  return (
    <iframe
      name={frameName}
      src={src}
      style="width:100%;border:none;"
      scrolling="no"
      title={path ? `Frame: ${path}` : `Frame depth ${outletDepth}`}
    />
  );
};