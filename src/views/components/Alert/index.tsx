import type { FC, PropsWithChildren } from "hono/jsx";

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
  <section data-alert={variant}>
    <span aria-hidden="true">{icons[variant]}</span>
    <div>
      <h5>{header}</h5>
      {subheader && <h6>{subheader}</h6>}
    </div>
    {children}
  </section>
);
