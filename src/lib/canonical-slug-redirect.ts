import { useNavigate } from "@tanstack/react-router";
import { formatMediaTitle } from "./utils";
import { useEffect } from "react";

export type RedirectEntityType = "movie" | "tv" | "collection";
export type SubPageEntityType = "home" | "media" | "cast-crew" | "seasons";

export function useCanonicalSlugRedirect(args: {
  entity: RedirectEntityType;
  subPageEntity: SubPageEntityType;
  id?: number | string;
  title?: string;
  incomingPathname: string;
  isLoading: boolean;
}): void {
  const { entity, subPageEntity, id, title, incomingPathname, isLoading } =
    args;
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !id || !title) {
      return;
    }

    const canonicalTitle = formatMediaTitle.encode(title);
    const requiredPathname = `/${entity}/${id}/${canonicalTitle}${
      subPageEntity === "home" ? "" : `/${subPageEntity}`
    }`;

    // Redirect only if the paths don't match
    if (incomingPathname !== requiredPathname) {
      console.log("redirecting");
      navigate({
        to: requiredPathname,
        replace: true,
      });
    }
  }, [entity, subPageEntity, id, title, incomingPathname, navigate, isLoading]);
}
