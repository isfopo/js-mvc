import type { FC, PropsWithChildren } from "hono/jsx";

export interface CardProps extends PropsWithChildren {
  title?: string;
  footer?: string;
  variant?: "default" | "flat" | "hover";
}

export const Card: FC<CardProps> = ({ title, footer, variant = "default", children }) => (
  <article data-card={variant}>
    {title && <header><h3>{title}</h3></header>}
    <div>{children}</div>
    {footer && <footer><p>{footer}</p></footer>}
  </article>
);
