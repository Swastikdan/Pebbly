import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

export const MediaDescription = ({ description }: { description: string }) => {
  const [isFullTextVisible, setIsFullTextVisible] = useState(false);
  const overviewId = useId();
  const toggleText = () => setIsFullTextVisible(!isFullTextVisible);

  return (
    <div className="py-3">
      <h3 className="text-lg font-semibold md:text-xl">Overview</h3>
      <div className="text-foreground/90 py-1.5 text-sm leading-relaxed sm:text-[15px]">
        <span className="hidden md:flex">{description}</span>
        <span className="flex flex-col md:hidden">
          <span id={overviewId}>
            {isFullTextVisible ? (
              <span>{description}</span>
            ) : (
              <span>{description.substring(0, 100)}...</span>
            )}
          </span>
          <Button
            className="text-foreground w-fit justify-end text-xs md:hidden"
            size="sm"
            variant="link"
            aria-expanded={isFullTextVisible}
            aria-controls={overviewId}
            onClick={toggleText}
          >
            {isFullTextVisible ? "Read Less" : "Read More"}
          </Button>
        </span>
      </div>
    </div>
  );
};
