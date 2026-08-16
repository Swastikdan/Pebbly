import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { DesktopNavButtons } from "@/components/desktop-nav-button";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_ITEMS, SITE_CONFIG } from "@/constants";

const NavSubmenuItems = ({
	items,
}: {
	items: { name: string; url: string; slug: string }[];
}) => {
	return (
		<>
			{items.map((subitem) => (
				<Link key={subitem.slug} to={subitem.url} className="cursor-pointer ">
					<DropdownMenuItem className="h-9 cursor-pointer rounded-lg px-3 text-base">
						{subitem.name}
					</DropdownMenuItem>
				</Link>
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
		<DropdownMenu>
			{/* Radix manages aria-haspopup / aria-expanded / data-state on the trigger. */}
			<DropdownMenuTrigger asChild className="cursor-pointer">
				<Button variant="secondary" className="px-3 text-base">
					{item.name}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				aria-label="Desktop Menu"
				align="end"
				className="mt-2 w-40 rounded-xl p-2 shadow-none"
			>
				<NavSubmenuItems items={item.submenu} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

DesktopNavMenuItem.displayName = "DesktopNavMenuItem";

const Navbar = () => {
	return (
		<header className="sticky top-0 z-50 mx-auto hidden w-full md:flex flex-col items-center border-border/60 border-b bg-background">
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

					<h1 className="font-bold font-heading text-lg md:text-xl">
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
