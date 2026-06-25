// @ts-nocheck
import { defineNitroConfig } from "nitropack";

export default defineNitroConfig({
  routeRules: {
    "/assets/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  }
});
