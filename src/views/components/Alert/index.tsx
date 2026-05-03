import type { FC, PropsWithChildren } from "hono/jsx";

export interface AlertProps extends PropsWithChildren {
  variant: "info" | "success" | "warning" | "error";
  title?: string;
}

const icons: Record<string, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

export const Alert: FC<AlertProps> = ({ variant, title, children }) => (
  <section data-alert={variant}>
    <span aria-hidden="true">{icons[variant]}</span>
    <div>
      {title && <p>{title}</p>}
      <p>{children}</p>
    </div>
  </section>
);
