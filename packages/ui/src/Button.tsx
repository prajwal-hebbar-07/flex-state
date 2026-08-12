import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function Button({ children, className, ...rest }: ButtonProps): ReactNode {
  return (
    <button type="button" className={`fs-button${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </button>
  );
}
