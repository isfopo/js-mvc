import type { FC } from "hono/jsx";

export interface FormFieldProps {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  value?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

export const FormField: FC<FormFieldProps> = ({
  name,
  label,
  type = "text",
  value,
  placeholder,
  error,
  required = false,
}) => (
  <div data-field={error ? "error" : ""}>
    <label for={name}>
      {label}
      {required && <span aria-hidden="true">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      placeholder={placeholder}
      required={required}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
    />
    {error && (
      <p id={`${name}-error`} role="alert">
        {error}
      </p>
    )}
  </div>
);
