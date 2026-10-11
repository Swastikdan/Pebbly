import { ListPlus } from "@/components/ui/hugeicons";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";

const imgClass =
  "size-full object-cover transition-transform duration-700 ease-out";
const frameClass = "overflow-hidden rounded-lg bg-muted/30";

export function ListCollage({
  previews,
  color,
}: {
  previews: string[];
  color?: string;
}) {
  const fallbackBg = color
    ? `linear-gradient(135deg, ${color}18 0%, ${color}35 100%)`
    : "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)";

  if (previews.length === 0) {
    return (
      <div
        className="flex size-full items-center justify-center rounded-lg ring-1 ring-black/5 transition-colors duration-300 ring-inset dark:ring-white/10"
        style={{ background: fallbackBg }}
      >
        <span className="bg-background/80 border-border flex size-11 items-center justify-center rounded-lg border">
          <ListPlus
            size={22}
            className="text-muted-foreground/60 transition-transform duration-300 group-hover/card:scale-110"
          />
        </span>
      </div>
    );
  }

  if (previews.length === 1) {
    return (
      <div className={`relative size-full ${frameClass}`}>
        <Image
          src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
          alt="List preview"
          layout="fullWidth"
          className={`${imgClass} group-hover/card:scale-[1.03]`}
        />
        {/* Subtle vignette — dark-only so light mode stays clean */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/20 to-transparent dark:from-black/40" />
      </div>
    );
  }

  if (previews.length === 2) {
    return (
      <div className={`grid size-full grid-cols-2 gap-[3px] ${frameClass}`}>
        {previews.slice(0, 2).map((preview, i) => (
          <div key={preview} className="size-full overflow-hidden">
            <Image
              src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
              alt={`List preview ${i + 1}`}
              layout="fullWidth"
              className={`${imgClass} group-hover/card:scale-[1.03]`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (previews.length === 3) {
    return (
      <div
        className={`grid size-full grid-cols-[2fr_1fr] gap-[3px] ${frameClass}`}
      >
        <div className="h-full overflow-hidden">
          <Image
            src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
            alt="List preview 1"
            layout="fullWidth"
            className={`${imgClass} group-hover/card:scale-[1.03]`}
          />
        </div>
        <div className="flex h-full flex-col gap-[3px]">
          {previews.slice(1, 3).map((preview, i) => (
            <div key={preview} className="flex-1 overflow-hidden">
              <Image
                src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
                alt={`List preview ${i + 2}`}
                layout="fullWidth"
                className={`${imgClass} size-full group-hover/card:scale-[1.03]`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4+ images: 2×2 grid
  return (
    <div
      className={`grid size-full grid-cols-2 grid-rows-2 gap-[3px] ${frameClass}`}
    >
      {previews.slice(0, 4).map((preview, i) => (
        <div key={preview} className="size-full overflow-hidden">
          <Image
            src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
            alt={`List preview ${i + 1}`}
            layout="fullWidth"
            className={`${imgClass} group-hover/card:scale-[1.03]`}
          />
        </div>
      ))}
    </div>
  );
}
