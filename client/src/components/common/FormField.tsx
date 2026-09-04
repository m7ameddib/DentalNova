import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, error, children, className }: FormFieldProps) {
  return (
    <label className={`form-field ${className ?? ''}`}>
      <span className="form-field__label">
        {label}
        {required && <span className="form-field__required">*</span>}
      </span>
      {children}
      {error && <span className="form-field__error">{error}</span>}
    </label>
  );
}
