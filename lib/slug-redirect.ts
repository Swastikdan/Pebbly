import { permanentRedirect } from "next/navigation";

import { formatMediaTitle } from "./utils";

export type EntityType = "movie" | "tv" | "collection";

export function ensureCanonicalSlugAndRedirect(args: {
  entity: EntityType;
  id: number | string;
  title: string;
  incomingPathname: string;
}): void {
  const { entity, id, title, incomingPathname } = args;

  const canonicalTitle = formatMediaTitle.encode(title);
  const requiredPathname = `/${entity}/${id}/${canonicalTitle}`;

  // Redirect only if the paths don't match
  if (incomingPathname !== requiredPathname) {
    permanentRedirect(requiredPathname);
  }
}
