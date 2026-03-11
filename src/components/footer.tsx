import { Link } from "@tanstack/react-router";

import { SITE_CONFIG } from "@/constants";

const Footer = () => {
	return (
		<footer className="mx-auto flex w-full items-center justify-center border-border/60 border-t">
			<section className="flex w-full max-w-screen-xl flex-col items-center justify-between gap-2 px-5 py-4 text-sm text-muted-foreground md:flex-row md:px-10">
				<p className="flex items-center gap-1">
					Made with{" "}
					<span aria-label="love" role="img">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="inline-block size-3.5 text-red-500"
						>
							<title>Love</title>
							<path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
						</svg>
					</span>{" "}
					By Swastik Dan
				</p>
				<div className="flex items-center gap-1">
					<Link
						aria-label="User disclaimer"
						to={SITE_CONFIG.Footerlinks.disclaimer}
						className="rounded-md px-2 py-1 transition-colors hover:text-foreground"
					>
						Disclaimer
					</Link>
					<span className="text-border">|</span>
					<Link
						aria-label={`Github repository for ${SITE_CONFIG.name}`}
						to={SITE_CONFIG.Footerlinks.github}
						rel="noopener noreferrer"
						target="_blank"
						className="rounded-md px-2 py-1 transition-colors hover:text-foreground"
					>
						Github
					</Link>
				</div>
			</section>
		</footer>
	);
};

export { Footer };
