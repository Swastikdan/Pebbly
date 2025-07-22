import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="border-border bg-background mx-auto flex w-full items-center justify-center border-t-2"
      role="contentinfo"
      aria-label="Footer"
    >
      <section className="font-heading lg;px-20 flex w-full max-w-screen-xl flex-col items-center justify-between gap-3 px-5 py-10 text-base font-light md:flex-row md:px-10">
        <p>
          Made with{" "}
          <span role="img" aria-label="love">
            ❤️
          </span>{" "}
          By Swastik Dan
        </p>
        <div className="flex items-center gap-5">
          <Link
            href="/disclaimer"
            className="underline"
            aria-label="User disclaimer"
          >
            Disclaimer
          </Link>

          <a
            href="https://github.com/Swastikdan/Film-Fanatic"
            target="_blank"
            className="underline"
            rel="noopener noreferrer"
            aria-label="Github repository for Film Fanatic"
          >
            Github
          </a>
        </div>
      </section>
    </footer>
  );
}
