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

const LAST_UPDATED = "October 04, 2026";

function DisclaimerPage() {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-xl p-4 sm:p-8">
        <div className="mb-6 md:hidden">
          <GoBack title="Back" />
        </div>
        <div className="mx-auto max-w-[65ch] space-y-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Disclaimer
            </h1>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              Last updated: {LAST_UPDATED}
            </p>
          </div>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              General Information
            </h2>
            <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
              <p>
                Pebbly is a personal, non-commercial project created for
                portfolio and demonstration purposes. The information provided
                on this website is for general informational purposes only.
              </p>
              <p>
                Pebbly is a discovery and tracking tool. It helps you browse,
                save, and keep track of movies and TV shows.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Third-Party Content & Data
            </h2>
            <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
              <p>
                All metadata, including but not limited to titles, synopses,
                ratings, release dates, artwork, and cast information, is
                provided by{" "}
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  The Movie Database (TMDb)
                </a>{" "}
                and its contributors. Streaming availability information is
                provided by JustWatch via TMDb.
              </p>
              <p>
                This product uses the TMDb API but is not endorsed or certified
                by TMDb. Pebbly does not claim ownership of any film,
                television, or person-related data, imagery, or trademarks
                displayed on this site. All rights remain with their respective
                owners.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Terms of Use
            </h2>
            <div className="text-muted-foreground space-y-6 text-base leading-relaxed">
              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  1. Personal & Non-Commercial Use
                </h3>
                <p>
                  The content and services provided on Pebbly are for personal
                  and non-commercial use only. You may not use the service for
                  any commercial purposes, resell access to it, or use automated
                  means to scrape or overload it.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  2. User Accounts & Data
                </h3>
                <p>
                  User authentication is provided through third-party services
                  (such as Clerk). To power personal features — including your
                  watchlist, watch progress and continue-watching history,
                  reactions, custom collections, and AI recommendations — Pebbly
                  stores your account profile information (such as your name,
                  email address, profile image, and account identifier) and
                  associated viewing activity on its databases. We do not sell
                  your personal data to third parties. You can export or delete
                  your data at any time from the{" "}
                  <Link to="/privacy" className="text-primary underline">
                    Privacy center
                  </Link>
                  .
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  3. AI Recommendations
                </h3>
                <p>
                  Recommendations, matches, and taste profiles may be generated
                  automatically, including by AI models, based on your viewing
                  activity. These suggestions are estimates only and may be
                  inaccurate, incomplete, or unexpected. They are not
                  endorsements and should not be relied upon as professional
                  advice.
                </p>
              </div>

              <div>
                <h3 className="text-foreground mb-2 font-medium">
                  4. Acceptable Use
                </h3>
                <p>
                  You agree not to misuse the service, attempt to gain
                  unauthorized access to it, or use it in any way that violates
                  applicable law or the rights of others.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Availability & Accuracy
            </h2>
            <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
              <p>
                Pebbly is provided on an "as available" basis and may change,
                break, or be discontinued at any time. Data from third parties
                may be delayed, incomplete, or incorrect, and release dates,
                availability, and ratings can change without notice.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Limitation of Liability
            </h2>
            <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
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
            <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
              <p>
                We reserve the right to modify this disclaimer at any time. We
                encourage you to review this page periodically for any changes.
                Continued use of Pebbly after an update constitutes acceptance
                of the revised terms.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t pt-8 text-center">
          <p className="text-muted-foreground mx-auto mb-4 max-w-[65ch] text-base leading-relaxed text-pretty">
            By using Pebbly, you acknowledge that you have read, understood, and
            agree to this disclaimer.
          </p>
          <Link to="/">
            <Button
              variant="secondary"
              className="transition-transform active:scale-[0.96] [@media(hover:hover)]:hover:scale-105"
            >
              Return to Home Page
            </Button>
          </Link>
          <p className="text-muted-foreground mt-6 text-xs">
            © {new Date().getFullYear()} Pebbly by Swastik Dan. Released under
            the MIT License.
          </p>
        </div>
      </div>
    </div>
  );
}
