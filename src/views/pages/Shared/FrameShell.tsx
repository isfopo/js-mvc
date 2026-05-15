import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./FrameShell.module.css";

interface FrameShellProps extends PropsWithChildren {
  depth: number;
}

/**
 * Minimal HTML shell for nested frames.
 * Includes CSS and client JS but no global navigation.
 * The Layout component is only rendered at depth 0.
 */
export const FrameShell: FC<FrameShellProps> = ({ children, depth }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Tenet</title>
      {/* Links/forms default to staying in this frame */}
      <base target="_self" />
      <link rel="stylesheet" href="/.generated/styles/index.css" />
      {import.meta.env.DEV ? (
        <>
          <script type="module" src="/@vite/client"></script>
          <script type="module" src="/src/infrastructure/client/main.ts"></script>
        </>
      ) : (
        <script type="module" src="/.generated/client/main.js"></script>
      )}
    </head>
    <body class={styles.shellBody} data-depth={depth}>
      {children}
    </body>
  </html>
);
