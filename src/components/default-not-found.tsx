import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function DefaultNotFoundComponent() {
  return (
    <div className="grid h-full min-h-[calc(100vh-250px)] place-content-center items-center justify-center">
      <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-8 py-8 ">
        <div className="text-center">
          <h3 className="mb-6 font-semibold text-5xl">Oops!</h3>

          <p className="mb-6">
            The page you’re looking for isn’t found, we suggest you back to
            home.
          </p>
          <Link to="/" className="rounded-[calc(var(--radius-md)+3px)]">
            <Button variant="secondary">Back to home page</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
