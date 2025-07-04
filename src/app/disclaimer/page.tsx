import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-md p-8">
        <div className="space-y-12">
          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Disclaimer
            </h2>
            <div className="space-y-4">
              <p>
                This application is a personal project created for demonstration
                purposes only. All movie data and content is provided by
                third-party services (TMDb) and we do not claim ownership of any
                media or intellectual property displayed.
              </p>
              <p>
                We do not store or process any sensitive user data. However, we
                cannot guarantee the security of any information entered into
                this application and users proceed at their own risk.
              </p>
              <div className="bg-accent rounded-md p-4">
                <h3 className="mb-2 font-medium">Important Notice</h3>
                <p className="">
                  This service is provided &quot;as-is&quot; without any
                  warranties, express or implied. We accept no liability for any
                  data loss, inaccuracies, or damages resulting from the use of
                  this application.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b pb-2 text-2xl font-semibold">
              Terms & Conditions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-medium">1. Intellectual Property</h3>
                <ul className="list-disc space-y-2 pl-6">
                  <li>
                    All movie data, images, and related content are property of
                    their respective owners
                  </li>
                  <li>
                    TMDb data is used in accordance with their API terms of
                    service
                  </li>
                  <li>
                    No commercial use of content displayed on this platform is
                    permitted
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-medium">2. Limitation of Liability</h3>
                <p>
                  Under no circumstances shall the developers or maintainers of
                  this application be liable for:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6">
                  <li>Any direct or indirect damages</li>
                  <li>Data loss or corruption</li>
                  <li>Service interruptions or downtime</li>
                  <li>Accuracy of provided information</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-medium">3. Third-Party Services</h3>
                <p>
                  This application relies on third-party services including but
                  not limited to:
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-6">
                  <li>The Movie Database (TMDb)</li>
                  <li>Next.js/Vercel hosting platform</li>
                  <li>Other API providers</li>
                </ul>
                <p className="mt-3">
                  We are not responsible for the content or reliability of these
                  third-party services.
                </p>
              </div>

              <div className="bg-accent rounded-md p-4">
                <h3 className="mb-2 font-medium">Changes to Terms</h3>
                <p>
                  We reserve the right to modify these terms at any time. Users
                  are responsible for regularly reviewing these terms and
                  conditions.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t pt-8 text-center">
          <p className="text-muted-foreground mb-4">
            By using this service, you acknowledge that you have read and
            understood these terms.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Return to Home Page</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
