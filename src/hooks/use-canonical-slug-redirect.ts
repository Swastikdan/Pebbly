import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { formatMediaTitle } from "@/lib/utils";

export type RedirectEntityType = MediaType | "collection";
export type SubPageEntityType =
  "home" | "media" | "cast-crew" | "seasons" | "collection" | (string & {});

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
      subPageEntity === "home" || subPageEntity === "collection"
        ? ""
        : `/${subPageEntity}`
    }`;

    if (incomingPathname !== requiredPathname) {
      navigate({
        to: requiredPathname,
        replace: true,
      });
    }
  }, [entity, subPageEntity, id, title, incomingPathname, navigate, isLoading]);
}
