import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./index.module.css";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends PropsWithChildren {
  variant: AlertVariant;
  header: string;
  subheader?: string;
}

const icons: Record<AlertVariant, string> = {
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
    <span class={styles.icon} aria-hidden="true">
      {icons[variant]}
    </span>
    <div class={styles.content}>
      <h5 class={styles.header}>{header}</h5>
      {subheader && <h6>{subheader}</h6>}
    </div>
    {children}
  </section>
);
