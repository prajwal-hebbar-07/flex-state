import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

export function Button({ children, ...rest }: ButtonProps): ReactNode {
  return (
    <button type="button" className="fs-button" {...rest}>
      {children}
    </button>
  );
}
