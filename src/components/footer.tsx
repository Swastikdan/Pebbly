import { Link } from "@tanstack/react-router";

import { FooterThemeSelect } from "@/components/footer-theme-select";
import { SITE_CONFIG } from "@/constants";
import { usePermissions } from "@/hooks/use-permissions";

const Footer = () => {
  const { isSignedIn, isAdmin } = usePermissions();

  return (
    <footer className="border-border/60 mx-auto flex w-full items-center justify-center border-t">
      <section className="text-muted-foreground flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs md:flex-row md:px-6">
        <p>Pebbly by Swastik Dan</p>
        <nav className="flex items-center gap-1" aria-label="Footer">
          {isSignedIn && isAdmin && (
            <>
              <Link
                to="/admin"
                className="hover:text-foreground rounded-md px-2 py-1 transition-colors"
              >
                Admin
              </Link>
              <span aria-hidden="true" className="text-border/60">
                ·
              </span>
            </>
          )}
          <FooterThemeSelect />
          <span aria-hidden="true" className="text-border/60">
            ·
          </span>
          <Link
            aria-label="User disclaimer"
            to={SITE_CONFIG.Footerlinks.disclaimer}
            className="hover:text-foreground rounded-md px-2 py-1 transition-colors"
          >
            Disclaimer
          </Link>
          <span aria-hidden="true" className="text-border/60">
            ·
          </span>
          <Link
            aria-label={`Github repository for ${SITE_CONFIG.name}`}
            to={SITE_CONFIG.Footerlinks.github}
            rel="noopener noreferrer"
            target="_blank"
            className="hover:text-foreground rounded-md px-2 py-1 transition-colors"
          >
            Github
          </Link>
        </nav>
      </section>
    </footer>
  );
};

export { Footer };
