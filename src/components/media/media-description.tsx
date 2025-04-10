"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function MediaDescription({
  description,
}: {
  description: string;
}) {
  const [isFullTextVisible, setIsFullTextVisible] = useState(false);
  const toggleText = () => setIsFullTextVisible(!isFullTextVisible);
  return (
    <div className="py-3">
      <span className="text-xl font-semibold md:text-2xl">Overview</span>
      <div className="py-1 text-sm sm:text-base">
        <span className="hidden md:inline">{description}</span>
        <span className="flex flex-col md:hidden">
          {isFullTextVisible ? (
            <span>{description}</span>
          ) : (
            <span>{description.substring(0, 100)}</span>
          )}
          <Button
            onClick={toggleText}
            variant="link"
            className="text-primary ml-2 w-min justify-end md:hidden"
          >
            {isFullTextVisible ? "Read Less" : "Read More"}
          </Button>
        </span>
      </div>
    </div>
  );
}
