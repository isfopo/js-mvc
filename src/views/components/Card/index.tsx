import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./index.module.css";

export interface CardProps extends PropsWithChildren {
  title?: string;
  footer?: string;
  variant?: "default" | "flat" | "hover";
}

export const Card: FC<CardProps> = ({ title, footer, variant = "default", children }) => (
  <article class={styles.card} data-card={variant}>
    {title && <header class={styles.header}><h3>{title}</h3></header>}
    <div class={styles.body}>{children}</div>
    {footer && <footer class={styles.footer}><p>{footer}</p></footer>}
  </article>
);
