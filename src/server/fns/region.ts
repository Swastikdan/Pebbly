import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { ok } from "../schema/common";

export const getEdgeRegion = createServerFn({ method: "GET" }).handler(() => {
  try {
    const cfCountry = getRequestHeader("cf-ipcountry");
    if (
      cfCountry &&
      cfCountry.length === 2 &&
      cfCountry !== "XX" &&
      cfCountry !== "T1"
    ) {
      return ok(cfCountry.toUpperCase());
    }

    const acceptLanguage = getRequestHeader("accept-language");
    if (acceptLanguage) {
      const match = /-[A-Z]{2}\b/i.exec(acceptLanguage);
      if (match) {
        return ok(match[0].slice(1).toUpperCase());
      }
    }
  } catch {
    // Fall back to default if request headers cannot be accessed
  }

  return ok("US");
});
