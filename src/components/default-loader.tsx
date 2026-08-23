import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"output">) {
  return (
    <output
      aria-label="Loading content"
      aria-busy="true"
      className={cn(
        "animate-fade-in grid min-h-[100dvh] w-full min-w-[320px] place-items-center py-8 md:min-h-[calc(100dvh-5rem)]",
        props.className,
      )}
      {...props}
    >
      <div className="grid size-12 place-items-center rounded-xl">
        <Spinner className="text-foreground/70 size-6" />
      </div>
      <span className="sr-only">Loading content</span>
    </output>
  );
}
