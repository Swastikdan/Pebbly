/** Sticky navigation bar with desktop dropdown menus and a mobile slide-out sheet. */
import { SignedIn } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ListPlus, Sparkles } from "lucide-react";
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
import { useRecommendationAccess } from "@/hooks/useRecommendations";

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
					className="rounded-lg px-3 text-base"
					aria-haspopup="true"
					aria-expanded="false"
				>
					{item.name}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				aria-label="Desktop Menu"
				align="end"
				className="mt-2 w-40 rounded-xl p-2 shadow-none"
			>
				{item.submenu.map((subitem) => (
					<Link key={subitem.slug} to={subitem.url} className="cursor-pointer ">
						<DropdownMenuItem className="h-9 cursor-pointer rounded-lg px-3 text-base">
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
		<div className="flex flex-col items-start justify-start gap-1.5">
			<Button
				variant="secondary"
				className="w-full justify-start rounded-lg font-bold text-sm h-9"
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
							className="h-9 w-full justify-start rounded-lg text-sm"
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
	const { hasAccess } = useRecommendationAccess();

	return (
		<header className="sticky top-0 z-50 mx-auto flex w-full flex-col items-center border-border/60 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300">
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
						alt="Film Fanatic logo"
						width={100}
						height={100}
						className="size-9"
					/>

					<h1 className="font-bold font-heading text-lg md:text-xl">
						Film Fanatic
					</h1>
				</Link>
				<section className="flex items-center gap-1.5 md:gap-2">
					<ul className="hidden gap-1.5 md:flex">
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
								className="rounded-lg font-heading font-light text-base"
								aria-label="Menu"
							>
								<MenuIcon />
							</Button>
						</SheetTrigger>
						<SheetContent
							className="border-none px-3 duration-0"
							aria-label="Mobile Navigation"
						>
							<SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
							<div className="scrollbar-small flex h-full flex-col gap-4 overflow-y-auto py-12 pt-20">
								{NAV_ITEMS.map((item) => (
									<MobileNavMenuItem key={item.slug} item={item} />
								))}
								<div className="flex flex-col gap-1.5 mt-1">
									<Link to="/watchlist" className="w-full">
										<SheetClose asChild>
											<Button
												variant="secondary"
												className="h-9 w-full justify-start gap-2 text-sm"
											>
												<BookMarkFilledIcon className="size-4 fill-current" />
												Watchlist
											</Button>
										</SheetClose>
									</Link>
									<SignedIn>
										<Link to="/watchlist" className="w-full">
											<SheetClose asChild>
												<Button
													variant="outline"
													className="h-9 w-full justify-start gap-2 text-sm"
												>
													<ListPlus className="size-4" />
													My Lists
												</Button>
											</SheetClose>
										</Link>
									</SignedIn>
									{hasAccess && (
										// @ts-expect-error correct link
										<Link to="/recommendations" className="w-full">
											<SheetClose asChild>
												<Button
													variant="outline"
													className="h-9 w-full justify-start gap-2 text-sm"
												>
													<Sparkles className="size-4 text-blue-500 fill-blue-500/20" />
													AI Recommendations
												</Button>
											</SheetClose>
										</Link>
									)}
								</div>
							</div>
						</SheetContent>
					</Sheet>
				</section>
			</nav>
		</header>
	);
};

export { Navbar };
