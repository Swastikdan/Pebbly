"use client";

import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("relative block opacity-[0.65]", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export interface SpinnerProps
  extends
    useRender.ComponentProps<"span">,
    VariantProps<typeof spinnerVariants> {
  loading?: boolean;
}

const LEAVES = Array.from({ length: 8 }, (_, i) => ({
  angle: i * 45,
  delay: -(7 - i) * 100,
}));

function extractBgClasses(className: string | undefined) {
  const bgClass = className?.match(/(?:dark:bg-|bg-)[a-zA-Z0-9-]+/g) || [];
  const filteredClassName = className
    ?.replace(/(?:dark:bg-|bg-)[a-zA-Z0-9-]+/g, "")
    .trim();
  return [bgClass, filteredClassName] as const;
}

export function Spinner({
  className,
  size,
  loading = true,
  render,
  ...props
}: SpinnerProps): React.ReactElement | null {
  const [bgColorClasses, filteredClassName] = extractBgClasses(className);

  const defaultProps = {
    children: LEAVES.map(({ angle, delay }) => (
      <span
        key={angle}
        className="animate-spinner-leaf-fade absolute top-0 left-1/2 h-full w-[12.5%]"
        style={{
          transform: `rotate(${angle}deg)`,
          animationDelay: `${delay}ms`,
        }}
      >
        <span
          className={cn(
            "block h-[30%] w-full rounded-full bg-current",
            bgColorClasses,
          )}
        />
      </span>
    )),
    className: cn(spinnerVariants({ className: filteredClassName, size })),
    "aria-label": "Loading",
    role: "status",
    "data-slot": "spinner",
  };

  const element = useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(defaultProps, props),
    render,
  });

  return loading ? element : null;
}
