'use client'
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import { Bookmark, Menu, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

import { NAV_ITEMS } from '@/constants'

const DesktopNavMenuItem: React.FC<{
  item: {
    name: string
    slug: string
    submenu: { name: string; url: string; slug: string }[]
  }
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
          <DropdownMenuItem className="h-9 cursor-pointer text-base">
            {subitem.name}
          </DropdownMenuItem>
        </Link>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

const MobileNavMenuItem: React.FC<{
  item: {
    name: string
    slug: string
    submenu: { name: string; url: string; slug: string }[]
  }
}> = ({ item }) => (
  <Accordion type="multiple">
    <AccordionItem value={item.name} className="border-0 pb-2">
      <AccordionTrigger className="h-12 rounded-xl bg-secondary px-4 py-2 text-base text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:no-underline">
        {item.name}
      </AccordionTrigger>
      {item.submenu.map((subitem, index) => (
        <Link href={subitem.url} key={index}>
          <AccordionContent className="my-1 flex h-12 items-center justify-center rounded-xl px-4 py-2 text-base font-medium hover:bg-accent hover:text-accent-foreground">
            <SheetClose className="w-full items-center justify-center text-left">
              {subitem.name}
            </SheetClose>
          </AccordionContent>
        </Link>
      ))}
    </AccordionItem>
  </Accordion>
)

export default function Navbar() {
  const pathname = usePathname()
  const isSearchButtonVisible = !(pathname === '/search' || pathname === '/')

  return (
    <header
      className="sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-b-2 border-border bg-background transition-transform duration-300"
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
            <h1 className="font-heading hidden text-lg font-bold xs:block md:text-xl xl:text-2xl">
              Film Fanatic
            </h1>
            <Badge
              variant="secondary"
              className="ml-2 hidden text-[10px] font-light xs:block"
            >
              Beta
            </Badge>
          </div>
        </Link>
        <section className="flex items-center gap-3">
          <ul className="hidden gap-2 md:flex" role="menubar">
            {NAV_ITEMS.map((item, index) => (
              <DesktopNavMenuItem key={index} item={item} />
            ))}
          </ul>
          {isSearchButtonVisible && (
            <Link href="/search">
              <Button
                variant="outline"
                size="icon"
                className="font-heading size-11 px-2 text-base font-light sm:size-9"
                aria-label="Search"
              >
                <Search size={24} />
              </Button>
            </Link>
          )}
          <TooltipProvider delayDuration={100} skipDelayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/watchlist" aria-label="Watchlist">
                  <Button
                    variant={
                      pathname === '/watchlist' ? 'secondary' : 'outline'
                    }
                    size="icon"
                    className="font-heading size-11 px-2 text-base font-light sm:size-9"
                    aria-label="Watchlist"
                  >
                    <Bookmark
                      size={32}
                      className={
                        pathname === '/watchlist' ? 'fill-current' : 'fill-none'
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
            <SheetContent
              className="w-full border-none duration-0"
              aria-label="Mobile Navigation"
            >
              <div className="scrollbar-small h-full overflow-y-auto py-12">
                {NAV_ITEMS.map((item, index) => (
                  <MobileNavMenuItem key={index} item={item} />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </nav>
    </header>
  )
}
