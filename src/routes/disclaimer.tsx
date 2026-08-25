import { createFileRoute, Link } from "@tanstack/react-router";

import { GoBack } from "@/components/go-back";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/disclaimer")({
  component: DisclaimerPage,
  head: () => ({
    meta: [
      { title: "Disclaimer | Pebbly" },
      {
        name: "description",
        content:
          "Disclaimer and terms of use for Pebbly, a personal project for browsing movie and TV information.",
      },
    ],
  }),
});

function DisclaimerPage() {
  return (
    <div className="animate-fade-in min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-xl p-4 sm:p-8">
        <div className="mb-6 md:hidden">
          <GoBack title="Back" />
        </div>
        <div className="stagger-grid space-y-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Disclaimer
            </h1>
            <p className="text-muted-foreground mt-4 text-lg">
              Last updated: August 02, 2026
            </p>
          </div>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              General Information
            </h2>
            <div className="text-muted-foreground space-y-4">
              <p>
                Pebbly is a personal, non-commercial project created for
                portfolio and demonstration purposes. The information provided
                on this website is for general informational purposes only.
              </p>
              <p>
                All data, including but not limited to, movie titles, synopses,
                ratings, and images, is provided by{" "}
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  The Movie Database (TMDb)
                </a>
                . Pebbly does not claim ownership of any of the film-related
                data or media displayed.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Terms of Use
            </h2>
            <div className="text-muted-foreground space-y-6">
              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  1. No Commercial Use
                </h3>
                <p>
                  The content and services provided on Pebbly are for personal
                  and non-commercial use only. You may not use the service for
                  any commercial purposes.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  2. User Accounts
                </h3>
                <p>
                  While we offer watchlist functionality, we do not store any
                  personally identifiable information on our servers. User data
                  is managed through third-party authentication providers. We
                  are not responsible for any issues related to these
                  third-party services.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Limitation of Liability
            </h2>
            <div className="text-muted-foreground space-y-4">
              <p>
                This website is provided "as is," without any warranties,
                express or implied. Your use of the service is at your sole
                risk.
              </p>
              <p>
                In no event shall the creators or maintainers of Pebbly be
                liable for any direct, indirect, incidental, special, or
                consequential damages arising out of or in connection with your
                use of the website. This includes, but is not limited to, data
                loss, service interruptions, or inaccuracies in the information
                provided.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Changes to This Disclaimer
            </h2>
            <div className="text-muted-foreground space-y-4">
              <p>
                We reserve the right to modify this disclaimer at any time. We
                encourage you to review this page periodically for any changes.
              </p>
            </div>
          </section>
        </div>

        <div
          className="animate-fade-in-up mt-12 border-t pt-8 text-center"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-muted-foreground mb-4">
            By using Pebbly, you acknowledge that you have read, understood, and
            agree to this disclaimer.
          </p>
          <Link to="/">
            <Button
              variant="secondary"
              className="transition-transform active:scale-95 [@media(hover:hover)]:hover:scale-105"
            >
              Return to Home Page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
