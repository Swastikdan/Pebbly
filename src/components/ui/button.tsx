import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold text-sm outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] active:shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 motion-reduce:transition-none motion-reduce:active:transform-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"border-primary/80 bg-primary text-primary-foreground shadow-[0_1px_0_color-mix(in_oklab,var(--primary),white_18%)_inset,0_1px_2px_rgb(0_0_0/0.18)] hover:bg-primary/90 hover:shadow-[0_1px_0_color-mix(in_oklab,var(--primary),white_22%)_inset,0_3px_8px_rgb(0_0_0/0.16)]",
				destructive:
					"border-destructive/80 bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/25",
				outline:
					"border-border/90 bg-background/80 shadow-xs hover:border-border hover:bg-accent hover:text-accent-foreground dark:bg-white/[0.035] dark:hover:bg-white/[0.07]",
				secondary:
					"border-border/70 bg-secondary text-secondary-foreground shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_1px_2px_rgb(0_0_0/0.12)] hover:bg-secondary/80",
				ghost:
					"text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-white/[0.06]",
				link: "text-primary underline-offset-4 hover:underline",
				light:
					"bg-primary-foreground text-primary hover:bg-primary-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 ",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 px-6 has-[>svg]:px-4",
				icon: "size-9 rounded-full",
				"icon-sm": "size-8 rounded-full",
				"icon-lg": "size-10 rounded-full",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button };
