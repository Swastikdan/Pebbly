/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
import React from "react";

import { Plus, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function WatchListButton({
  title,
  rating,
  image,
  id,
  media_type,
  relese_date,
  className,
}: {
  title: string;
  rating: number;
  image: string;
  id: number;
  media_type: "movie" | "tv";
  relese_date: string | null;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="default"
            className={cn(className, "z-20 size-9 p-2 [&>svg]:size-5")}
            aria-label="Add to watchlist"
            role="button"
          >
            <Check size={24} className="size-5" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="cursor-none select-none">
          <p className="text-sm font-medium">Add to Watchlist</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
