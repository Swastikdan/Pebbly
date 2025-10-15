import { ScrollContainer } from "@/components/scroll-container";

import {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";

import { Image } from "@/components/ui/image";
import { Play } from "@/components/ui/icons";

export function MediaPosterTrailerContainer(props: {
  image: string;
  title: string;
  trailervideos: Array<{ key: string; name: string }>;
}) {
  const { image, title, trailervideos } = props;
  return (
    <div className="flex flex-col justify-start gap-3 pb-3 sm:flex-row">
      <Image
        alt={title}
        className="bg-accent h-full w-full rounded-xl object-center sm:h-56 sm:w-auto md:h-70 lg:h-80"
        height={450}
        src={image}
        width={300}
      />

      {trailervideos.length > 0 && (
        <ScrollContainer className="h-full flex-1">
          <div className="flex h-full gap-3">
            {trailervideos.map((video, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <div className="group relative cursor-pointer">
                    <Image
                      alt={video.name}
                      className="bg-accent aspect-video h-48 w-auto rounded-xl object-cover sm:h-56 md:h-70 lg:h-80"
                      height={450}
                      src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
                      width={300}
                    />
                    <span className="absolute top-4 left-4 truncate text-sm text-foreground px-2 py-1 rounded-lg bg-background dark:bg-foreground dark:text-background w-min  turnicate max-w-[300px] sm:max-w-[350px] md:max-w-[400px] lg:max-w-[500px]">
                      {video.name}
                    </span>
                    <button className="absolute inset-0 flex items-center justify-center">
                      <div className="cursor-pointer rounded-full bg-black/60 p-4 transition-transform group-hover:scale-110 pressable">
                        <Play
                          className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105 pressable"
                          style={{
                            filter:
                              "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
                          }}
                        />
                      </div>
                    </button>
                  </div>
                </DialogTrigger>
                <DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
                  <DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-xl border-0 p-0 ring-0">
                    <DialogHeader className="sr-only">
                      <DialogTitle>{video.name}</DialogTitle>
                    </DialogHeader>
                    <div className="bg-default/80 relative isolate z-[1] size-full h-full overflow-hidden rounded-xl p-0">
                      <iframe
                        allowFullScreen
                        allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
                        className="size-full rounded-xl"
                        src={`https://www.youtube.com/embed/${video.key}`}
                        title={video.name}
                      />
                    </div>
                  </DialogContent>
                </DialogOverlay>
              </Dialog>
            ))}
          </div>
        </ScrollContainer>
      )}
    </div>
  );
}
