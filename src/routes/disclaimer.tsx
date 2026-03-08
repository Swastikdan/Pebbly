import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/disclaimer")({
	component: DisclaimerPage,
	head: () => ({
		meta: [
			{ title: "Disclaimer | Film Fanatic" },
			{
				name: "description",
				content:
					"Disclaimer and terms of use for Film Fanatic, a personal project showcasing movie and TV information.",
			},
		],
	}),
});

function DisclaimerPage() {
	return (
		<div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
			<div className="mx-auto max-w-4xl rounded-xl p-8">
				<div className="space-y-12 stagger-grid">
					<div className="text-center">
						<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Disclaimer</h1>
						<p className="mt-4 text-lg text-muted-foreground">
							Last updated: March 08, 2026
						</p>
					</div>

					<section>
						<h2 className="mb-4 border-b pb-2 font-semibold text-2xl">
							General Information
						</h2>
						<div className="space-y-4 text-muted-foreground">
							<p>
								Film Fanatic is a personal, non-commercial project created for portfolio and demonstration purposes. The information provided on this website is for general informational purposes only.
							</p>
							<p>
								All data, including but not limited to, movie titles, synopses, ratings, and images, is provided by{" "}
								<a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">The Movie Database (TMDb)</a>.
								Film Fanatic does not claim ownership of any of the film-related data or media displayed.
							</p>
						</div>
					</section>

					<section>
						<h2 className="mb-4 border-b pb-2 font-semibold text-2xl">
							Terms of Use
						</h2>
						<div className="space-y-6 text-muted-foreground">
							<div>
								<h3 className="mb-2 font-medium text-foreground">1. No Commercial Use</h3>
								<p>
									The content and services provided on Film Fanatic are for personal and non-commercial use only. You may not use the service for any commercial purposes.
								</p>
							</div>

							<div>
								<h3 className="mb-2 font-medium text-foreground">2. User Accounts</h3>
								<p>
									While we offer watchlist functionality, we do not store any personally identifiable information on our servers. User data is managed through third-party authentication providers. We are not responsible for any issues related to these third-party services.
								</p>
							</div>
						</div>
					</section>

					<section>
						<h2 className="mb-4 border-b pb-2 font-semibold text-2xl">
							Limitation of Liability
						</h2>
						<div className="space-y-4 text-muted-foreground">
							<p>
								This website is provided "as is," without any warranties, express or implied. Your use of the service is at your sole risk.
							</p>
							<p>
								In no event shall the creators or maintainers of Film Fanatic be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in connection with your use of the website. This includes, but is not limited to, data loss, service interruptions, or inaccuracies in the information provided.
							</p>
						</div>
					</section>

					<section>
						<h2 className="mb-4 border-b pb-2 font-semibold text-2xl">
							Changes to This Disclaimer
						</h2>
						<div className="space-y-4 text-muted-foreground">
							<p>
								We reserve the right to modify this disclaimer at any time. We encourage you to review this page periodically for any changes.
							</p>
						</div>
					</section>
				</div>

				<div
					className="mt-12 border-t pt-8 text-center animate-fade-in-up"
					style={{ animationDelay: "100ms" }}
				>
					<p className="mb-4 text-muted-foreground">
						By using Film Fanatic, you acknowledge that you have read, understood, and agree to this disclaimer.
					</p>
					<Link to="/">
						<Button
							variant="secondary"
							className="transition-transform hover:scale-105 active:scale-95"
						>
							Return to Home Page
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
