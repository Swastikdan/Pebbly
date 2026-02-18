import { Link } from "@tanstack/react-router";

import { SITE_CONFIG } from "@/constants";

const Footer = () => {
	return (
		<footer className="mx-auto flex w-full items-center justify-center border-border border-t-2 font-medium">
			<section className="flex w-full max-w-screen-xl flex-col items-center justify-between gap-3 px-5 py-5 font-light text-base md:flex-row md:px-10">
				<p>
					Made with{" "}
					<span aria-label="love" role="img">
						❤️
					</span>{" "}
					By Swastik Dan
				</p>
				<div className="flex items-center gap-3">
					<Link
						aria-label="User disclaimer"
						to={SITE_CONFIG.Footerlinks.disclaimer}
						className="rounded-md px-2"
					>
						Disclaimer
					</Link>

					<Link
						aria-label="Github repository for Film Fanatic"
						to={SITE_CONFIG.Footerlinks.github}
						rel="noopener noreferrer"
						target="_blank"
						className="rounded-md px-2"
					>
						Github
					</Link>
				</div>
			</section>
		</footer>
	);
};

export { Footer };
