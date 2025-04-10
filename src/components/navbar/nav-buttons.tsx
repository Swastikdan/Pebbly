"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bookmark, Search, type LucideIcon } from "lucide-react";

interface DesktopNavButtonProps {
  href: string;
  label: string;
  icon: LucideIcon;
  tooltipPosition?: "top" | "bottom" | "left" | "right";
  tooltipText: string;
}

function DesktopNavButton({
  href,
  label,
  icon,
  tooltipPosition = "bottom",
  tooltipText = label,
}: DesktopNavButtonProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} aria-label={label}>
            <Button
              variant={isActive ? "secondary" : "outline"}
              size="icon"
              className="font-heading size-11 rounded-full px-2 text-base font-light sm:size-9"
              aria-label={label}
            >
              {React.createElement(icon, {
                size: 32,
                className: isActive ? "fill-current" : "fill-none",
              })}
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side={tooltipPosition}>
          <p className="text-sm font-medium">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function DesktopNavButtons() {
  return (
    <>
      <DesktopNavButton
        href="/search"
        label="Search"
        icon={Search}
        tooltipText="Search"
      />
      <DesktopNavButton
        href="/watchlist"
        label="Watchlist"
        icon={Bookmark}
        tooltipText="Watchlist"
      />
    </>
  );
}
