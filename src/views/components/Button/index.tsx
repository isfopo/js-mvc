import type { FC } from "hono/jsx";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export const Button: FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  type = "button",
  disabled = false,
}) => (
  <button data-variant={variant} data-size={size} type={type} disabled={disabled}>
    {children}
  </button>
);
