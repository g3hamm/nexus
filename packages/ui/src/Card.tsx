import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children?: ReactNode;
  readonly padded?: boolean;
}

export function Card({ className, padded = true, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "border-line bg-surface shadow-soft rounded-lg border",
        padded && "p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
