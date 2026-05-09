import type { FC, PropsWithChildren } from "hono/jsx";
import styles from "./index.module.css";
import { action, handler } from "../../shared/action";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends PropsWithChildren {
  variant: AlertVariant;
  header: string;
  subheader?: string;
}

export const Alert: FC<AlertProps> = ({ variant, header, children }) => (
  <section
    class={styles.alert}
    data-alert={variant}
    data-controller={handler("dismiss")}
  >
    <span class={styles.icon} aria-hidden="true"></span>
    <div class={styles.content}>
      <h5 class={styles.header}>{header}</h5>
      {children}
    </div>
    <button
      class={styles.dismiss}
      data-action={action("click", "dismiss", "hide")}
      aria-label="Dismiss"
    >
      ✕
    </button>
  </section>
);
