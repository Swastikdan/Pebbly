"use client";
import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { Bookmark, Menu } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { name: "Movies", url: "/movies" },
  { name: "TV Shows", url: "/tv-shows" },
  { name: "People", url: "/peoples" },
];

const NavLink: React.FC<{ name: string; url: string; isActive: boolean }> = ({
  name,
  url,
  isActive,
}) => (
  <Link href={url}>
    <Button
      variant={isActive ? "secondary" : "outline"}
      className="px-2 text-base font-light"
    >
      {name}
    </Button>
  </Link>
);

const MobileNavLink: React.FC<{ name: string; url: string }> = ({
  name,
  url,
}) => (
  <Link href={url}>
    <Button
      variant="ghost"
      className="h-12 w-full justify-start text-lg font-light"
    >
      {name}
    </Button>
  </Link>
);

export default function Navbar() {
  const pathname = usePathname();
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    if (window.scrollY > lastScrollY) {
      setShowNavbar(false);
    } else {
      setShowNavbar(true);
    }
    setLastScrollY(window.scrollY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  return (
    <header
      className={`sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-b-2 border-border transition-transform duration-300 ${
        showNavbar ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <nav className="flex w-full max-w-screen-xl items-center justify-between bg-background p-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Home">
          <Image
            src="/logo.svg"
            alt="Film Fanatic logo"
            width={100}
            height={100}
            className="size-10"
          />
          <h1 className="font-heading text-lg font-bold md:text-xl xl:text-2xl">
            Film Fanatic
          </h1>
        </Link>
        <section className="flex items-center gap-3">
          <ul className="hidden gap-2 sm:flex">
            {navLinks.map((link, index) => (
              <NavLink
                key={index}
                name={link.name}
                url={link.url}
                isActive={pathname === link.url}
              />
            ))}
          </ul>

          <TooltipProvider delayDuration={100} skipDelayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/watchlist" aria-label="Watchlist">
                  <Button
                    variant={
                      pathname === "/watchlist" ? "secondary" : "outline"
                    }
                    size="icon"
                    className="font-heading size-11 px-2 text-base font-light sm:size-9"
                    aria-label="Watchlist"
                  >
                    <Bookmark
                      size={32}
                      className={
                        pathname === "/watchlist" ? "fill-current" : "fill-none"
                      }
                    />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm font-medium">Watchlist</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Sheet>
            <SheetTrigger className="md:hidden" asChild>
              <Button
                variant="outline"
                size="icon"
                className="font-heading size-11 px-2 text-base font-light sm:size-9"
                aria-label="Menu"
              >
                <Menu size={32} className="fill-current" />
              </Button>
            </SheetTrigger>
            <SheetContent className="border-none duration-0">
              <div className="flex flex-col gap-1 pt-12">
                {navLinks.map((link, index) => (
                  <MobileNavLink key={index} name={link.name} url={link.url} />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </nav>
    </header>
  );
}
