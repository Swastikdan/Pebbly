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
import { BookMarkFilledIcon, MenuIcon } from "@/components/ui/icons";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_ITEMS } from "@/constants";

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
			<DropdownMenuTrigger asChild className="cursor-pointer">
				<Button
					variant="secondary"
					className="rounded-[calc(var(--radius-md)+3px)] px-3 text-base"
					aria-haspopup="true"
					aria-expanded="false"
				>
					{item.name}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				aria-label="Desktop Menu"
				align="end"
				className="mt-2 w-40 rounded-[calc(var(--radius-md)+10px)] p-2 shadow-none"
			>
				{item.submenu.map((subitem) => (
					<Link key={subitem.slug} to={subitem.url} className="cursor-pointer ">
						<DropdownMenuItem className="h-9 cursor-pointer rounded-[calc(var(--radius-md)+3px)] px-3 text-base">
							{subitem.name}
						</DropdownMenuItem>
					</Link>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

DesktopNavMenuItem.displayName = "DesktopNavMenuItem";

const MobileNavMenuItem = ({
	item,
}: {
	item: {
		name: string;
		slug: string;
		submenu: { name: string; url: string; slug: string }[];
	};
}) => {
	return (
		<div className="flex flex-col items-start justify-start gap-2">
			<Button
				variant="secondary"
				className="w-full justify-start rounded-[calc(var(--radius-md)+3px)] font-bold"
			>
				{item.name}
			</Button>
			{item.submenu.map((subitem) => (
				<Link
					to={subitem.url}
					key={subitem.slug}
					className="w-full cursor-pointer justify-start pl-3"
				>
					<SheetClose asChild>
						<Button
							variant="outline"
							className="h-10 w-full justify-start rounded-[calc(var(--radius-md)+3px)]"
						>
							{subitem.name}
						</Button>
					</SheetClose>
				</Link>
			))}
		</div>
	);
};

MobileNavMenuItem.displayName = "MobileNavMenuItem";

const Navbar = () => {
	return (
		<header className="sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-border border-b-2 bg-background transition-transform duration-300">
			<nav
				className="flex w-full max-w-screen-xl items-center justify-between p-3"
				aria-label="Main Navigation"
			>
				<Link to="/" className="flex items-center gap-3" aria-label="Home">
					<Image
						src="/logo.svg"
						alt="Film Fanatic logo"
						width={100}
						height={100}
						className="size-10"
					/>
					<div className="flex items-start">
						<h1 className="font-bold font-heading text-lg md:text-xl xl:text-2xl">
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
								className="rounded-md px-2 font-heading font-light text-base"
								aria-label="Menu"
							>
								<MenuIcon />
							</Button>
						</SheetTrigger>
						<SheetContent
							className="border-none px-2 duration-0"
							aria-label="Mobile Navigation"
						>
							<SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
							<div className="scrollbar-small flex h-full flex-col gap-6 overflow-y-auto py-12 pt-20">
								{NAV_ITEMS.map((item) => (
									<MobileNavMenuItem key={item.slug} item={item} />
								))}
								<Link to="/watchlist" className="w-full">
									<SheetClose asChild>
										<Button
											variant="secondary"
											className="h-10 w-full justify-start"
										>
											<BookMarkFilledIcon className="fill-current" />
											Watchlist
										</Button>
									</SheetClose>
								</Link>
							</div>
						</SheetContent>
					</Sheet>
				</section>
			</nav>
		</header>
	);
};

export { Navbar };
