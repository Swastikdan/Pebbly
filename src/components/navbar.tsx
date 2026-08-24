import { Image } from "@unpic/react";
import { Link } from "@tanstack/react-router";

import { DesktopNavButtons } from "@/components/desktop-nav-button";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuLinkItem,
  MenuPopup,
  MenuTrigger,
} from "@/components/ui/menu";
import { NAV_ITEMS, SITE_CONFIG } from "@/constants";

const NavSubmenuItems = ({
  items,
}: {
  items: { name: string; url: string; slug: string }[];
}) => {
  return (
    <>
      {items.map((subitem) => (
        <MenuLinkItem
          key={subitem.slug}
          render={<Link to={subitem.url} />}
          className="h-9 cursor-pointer rounded-lg px-3 text-base"
        >
          {subitem.name}
        </MenuLinkItem>
      ))}
    </>
  );
};

const DesktopNavMenuItem = ({
  item,
}: {
  item: {
    name: string;
    slug: string;
    submenu: { name: string; url: string; slug: string }[];
  };
}) => {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="secondary"
            className="cursor-pointer px-3 text-base"
          />
        }
      >
        {item.name}
      </MenuTrigger>
      <MenuPopup
        align="end"
        aria-label="Desktop Menu"
        className="mt-2 w-40 rounded-xl p-2 shadow-none"
      >
        <NavSubmenuItems items={item.submenu} />
      </MenuPopup>
    </Menu>
  );
};

DesktopNavMenuItem.displayName = "DesktopNavMenuItem";

const Navbar = () => {
  return (
    <header className="border-border/60 bg-background sticky top-0 z-50 mx-auto hidden w-full flex-col items-center border-b md:flex">
      <nav
        className="flex w-full max-w-screen-xl items-center justify-between px-4 py-2.5 md:px-5"
        aria-label="Main Navigation"
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
          aria-label="Home"
        >
          <Image
            src="/logo.svg"
            alt={`${SITE_CONFIG.name} logo`}
            width={100}
            height={100}
            className="size-9"
          />

          <h1 className="font-heading text-lg font-bold md:text-xl">
            {SITE_CONFIG.name}
          </h1>
        </Link>
        <section className="flex items-center gap-1.5 md:gap-2">
          <ul className="hidden gap-1.5 md:flex">
            {NAV_ITEMS.map((item) => (
              <DesktopNavMenuItem key={item.slug} item={item} />
            ))}
          </ul>
          <div className="hidden md:flex md:items-center md:gap-1.5">
            <DesktopNavButtons />
          </div>
        </section>
      </nav>
    </header>
  );
};

export { Navbar };
