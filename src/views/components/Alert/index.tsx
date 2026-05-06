import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./index.module.css";

export interface AlertProps extends PropsWithChildren {
  variant: "info" | "success" | "warning" | "error";
  header: string;
  subheader?: string;
}

const icons: Record<string, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

export const Alert: FC<AlertProps> = ({
  variant,
  header,
  subheader,
  children,
}) => (
  <section class={styles.alert} data-alert={variant}>
    <span class={styles.icon} aria-hidden="true">{icons[variant]}</span>
    <div class={styles.content}>
      <h5 class={styles.header}>{header}</h5>
      {subheader && <h6 class={styles.subheader}>{subheader}</h6>}
    </div>
    {children}
  </section>
);
