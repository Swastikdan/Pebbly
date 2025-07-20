"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";
import { Bookmark, Search, type LucideIcon } from "lucide-react";
import ThemeToggle from "./theme-toggle";

function DesktopNavButton({
  href,
  label,
  icon,
  className,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} aria-label={label} className="cursor-pointer">
      <Button
        variant={isActive ? "secondary" : "outline"}
        size="icon"
        className={cn(
          "font-heading size-11 cursor-pointer rounded-xl px-2 text-base font-normal sm:size-9",
          className,
        )}
        aria-label={label}
      >
        {React.createElement(icon, {
          size: 32,
          className: isActive ? "fill-current" : "fill-none",
        })}
      </Button>
    </Link>
  );
}

export default function DesktopNavButtons() {
  return (
    <>
      <DesktopNavButton
        href="/watchlist"
        label="Watchlist"
        icon={Bookmark}
        className="hidden items-center justify-center md:flex"
      />
      <DesktopNavButton href="/search" label="Search" icon={Search} />
      <ThemeToggle />
    </>
  );
}
