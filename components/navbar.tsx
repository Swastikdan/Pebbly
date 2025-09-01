"use client";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import Link from "next/link";
import { Link as NextUiLink } from "@heroui/link";
import { useState } from "react";

import { siteConfig } from "@/config/site";

import { BookMarkFilledIcon, Logo, SearchFilledIcon } from "./icons";
import { ThemeSwitch } from "./theme-switch";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <HeroUINavbar
      isMenuOpen={isMobileMenuOpen}
      maxWidth="xl"
      position="sticky"
      onMenuOpenChange={setIsMobileMenuOpen}
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="max-w-fit gap-3">
          <Link className="flex items-center justify-start gap-1" href="/">
            <Logo className="size-10" height={100} width={100} />
            <h1 className="text-lg font-bold text-inherit md:text-xl xl:text-2xl">
              Film Fanatic
            </h1>
          </Link>
        </NavbarBrand>
      </NavbarContent>
      <NavbarContent
        className="flex basis-1/5 gap-2! sm:basis-full md:gap-4!"
        justify="end"
      >
        {siteConfig.navItems.map((item) => (
          <Dropdown key={item.name} backdrop="opaque">
            <DropdownTrigger className="hidden md:flex">
              <Button variant="flat">{item.name}</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Static Actions" variant="flat">
              {item.submenu.map((subitem) => (
                <DropdownItem
                  key={subitem.slug}
                  as={NextUiLink}
                  className="text-foreground h-9 w-full text-lg"
                  href={subitem.url}
                >
                  {subitem.name}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        ))}
        <NavbarItem isActive>
          <Button
            isIconOnly
            as={NextUiLink}
            href="/watchlist"
            startContent={<BookMarkFilledIcon className="size-5" />}
            variant="flat"
          />
        </NavbarItem>
        <NavbarItem>
          <Button
            isIconOnly
            as={NextUiLink}
            href="/search"
            startContent={<SearchFilledIcon className="size-5" />}
            variant="flat"
          />
        </NavbarItem>

        <NavbarItem>
          <ThemeSwitch />
        </NavbarItem>
        <NavbarMenuToggle className="ml-2 md:hidden" />
      </NavbarContent>
      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2 font-semibold">
          {siteConfig.navItems.map((item) => (
            <Accordion key={item.name} variant="splitted">
              <AccordionItem
                key={item.name}
                aria-label={item.name}
                title={item.name}
              >
                {item.submenu.map((subitem) => (
                  <NavbarMenuItem key={subitem.slug} className="py-2">
                    <Button
                      key={subitem.slug}
                      fullWidth
                      as={NextUiLink}
                      className="justify-start text-start"
                      href={subitem.url}
                      variant="solid"
                      onPress={() => setIsMobileMenuOpen(false)}
                    >
                      {subitem.name}
                    </Button>
                  </NavbarMenuItem>
                ))}
              </AccordionItem>
            </Accordion>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
}
