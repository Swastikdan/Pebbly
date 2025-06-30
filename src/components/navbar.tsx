import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import Image from "next/image";
import { NAV_ITEMS } from "@/constants";

import { Bookmark, Menu } from "lucide-react";
import DesktopNavButtons from "./desktop-nav-button";

const DesktopNavMenuItem: React.FC<{
  item: {
    name: string;
    slug: string;
    submenu: { name: string; url: string; slug: string }[];
  };
}> = ({ item }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild className="cursor-pointer">
      <Button
        variant="secondary"
        className="font-li px-3 text-base"
        aria-haspopup="true"
        aria-expanded="false"
      >
        {item.name}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      aria-label="Desktop Menu"
      align="end"
      className="mt-2 w-40 p-2"
    >
      {item.submenu.map((subitem) => (
        <Link key={subitem.slug} href={subitem.url} className="cursor-pointer">
          <DropdownMenuItem className="h-9 cursor-pointer px-3 text-base">
            {subitem.name}
          </DropdownMenuItem>
        </Link>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const MobileNavMenuItem: React.FC<{
  item: {
    name: string;
    slug: string;
    submenu: { name: string; url: string; slug: string }[];
  };
}> = ({ item }) => (
  <div className="flex flex-col items-start justify-start gap-2">
    <Button variant="secondary" className="w-full justify-start font-bold">
      {item.name}
    </Button>
    {item.submenu.map((subitem) => (
      <Link
        href={subitem.url}
        key={subitem.slug}
        className="w-full cursor-pointer justify-start px-3"
      >
        <Button variant="ghost" className="w-full justify-start">
          {subitem.name}
        </Button>
      </Link>
    ))}
  </div>
);

export default function Navbar() {
  return (
    <header className="border-border bg-background sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-b-2 transition-transform duration-300">
      <nav
        className="flex w-full max-w-screen-xl items-center justify-between p-3"
        aria-label="Main Navigation"
      >
        <Link href="/" className="flex items-center gap-3" aria-label="Home">
          <Image
            src="/logo.svg"
            alt="Film Fanatic logo"
            width={100}
            height={100}
            className="size-10"
          />
          <div className="flex items-start">
            <h1 className="font-heading text-lg font-bold md:text-xl xl:text-2xl">
              Film Fanatic
            </h1>
          </div>
        </Link>
        <section className="flex items-center gap-2 md:gap-3">
          <ul className="hidden gap-2 md:flex">
            {NAV_ITEMS.map((item) => (
              <DesktopNavMenuItem key={item.slug} item={item} />
            ))}
          </ul>
          <DesktopNavButtons />
          <Sheet>
            <SheetTrigger className="md:hidden" asChild>
              <Button
                variant="outline"
                size="icon"
                className="font-heading size-11 rounded-md px-2 text-base font-light sm:size-9"
                aria-label="Menu"
              >
                <Menu size={32} className="fill-current" />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="border-none px-2 duration-0"
              aria-label="Mobile Navigation"
            >
              <div className="scrollbar-small flex h-full flex-col gap-6 overflow-y-auto py-12 pt-20">
                {NAV_ITEMS.map((item) => (
                  <MobileNavMenuItem key={item.slug} item={item} />
                ))}
                <Link href="/watchlist" className="w-full">
                  <Button className="h-10 w-full justify-start">
                    <Bookmark size={32} className="fill-current" />
                    Watchlist
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </nav>
    </header>
  );
}
