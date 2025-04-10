import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { NAV_ITEMS } from "@/constants";
import NavButtons from "./nav-buttons";
import { Menu } from "lucide-react";

const DesktopNavMenuItem: React.FC<{
  item: {
    name: string;
    slug: string;
    submenu: { name: string; url: string; slug: string }[];
  };
}> = ({ item }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="secondary"
        className="px-3 text-base"
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
      {item.submenu.map((subitem, index) => (
        <Link key={index} href={subitem.url} className="cursor-pointer">
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
  <Accordion type="multiple">
    <AccordionItem value={item.name} className="border-0 pb-2">
      <AccordionTrigger className="bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-2 h-12 rounded-xl px-4 py-2 text-base shadow-sm hover:no-underline">
        {item.name}
      </AccordionTrigger>
      {item.submenu.map((subitem, index) => (
        <Link href={subitem.url} key={index} className="cursor-pointer">
          <AccordionContent className="bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 my-1 flex h-10 items-center justify-center rounded-xl border px-4 py-2 text-base font-medium shadow-xs">
            <SheetClose className="w-full items-center justify-center text-left">
              {subitem.name}
            </SheetClose>
          </AccordionContent>
        </Link>
      ))}
    </AccordionItem>
  </Accordion>
);

export default function Navbar() {
  return (
    <header
      className="border-border bg-background sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-b-2 transition-transform duration-300"
      role="banner"
    >
      <nav
        className="flex w-full max-w-screen-xl items-center justify-between p-3"
        role="navigation"
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
            <h1 className="font-heading text-lg font-black md:text-xl xl:text-2xl">
              Film Fanatic
            </h1>
          </div>
        </Link>
        <section className="flex items-center gap-3">
          <ul className="hidden gap-2 md:flex" role="menubar">
            {NAV_ITEMS.map((item, index) => (
              <DesktopNavMenuItem key={index} item={item} />
            ))}
          </ul>
          <NavButtons />
          <Sheet>
            <SheetTrigger className="md:hidden" asChild>
              <Button
                variant="outline"
                size="icon"
                className="font-heading size-11 rounded-full px-2 text-base font-light sm:size-9"
                aria-label="Menu"
              >
                <Menu size={32} className="fill-current" />
              </Button>
            </SheetTrigger>
            <SheetContent
              className="border-none px-2 duration-0"
              aria-label="Mobile Navigation"
            >
              <div className="scrollbar-small h-full overflow-y-auto py-12 pt-20">
                {NAV_ITEMS.map((item, index) => (
                  <MobileNavMenuItem key={index} item={item} />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </nav>
    </header>
  );
}
