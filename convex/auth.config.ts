export default {
  providers: [
    {
      domain: process.env.CONVEX_CLERK_ISSUER_URL,
      applicationID: "convex",
    },
  ],
};
