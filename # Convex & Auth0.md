# Convex & Auth0

[Auth0](https://auth0.com) is an authentication platform providing login via passwords, social identity providers, one-time email or SMS access codes, multi-factor authentication, and single sign on and basic user management.

**Example:** [Convex Authentication with Auth0](https://github.com/get-convex/convex-demos/tree/main/users-and-auth)

If you're using Next.js see the [Next.js setup guide](https://docs.convex.dev/client/nextjs).

## Get started[​](#get-started "Direct link to Get started")

This guide assumes you already have a working React app with Convex. If not follow the [Convex React Quickstart](/quickstart/react.md) first. Then:

1. Follow the Auth0 React quickstart

   Follow the [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react/interactive).

   Sign up for a free Auth0 account.

   Configure your application, using `http://localhost:3000, http://localhost:5173` for Callback and Logout URLs and Allowed Web Origins.

   Come back when you finish the *Install the Auth0 React SDK* step.

   ![Sign up to Auth0](/screenshots/auth0-signup.png)

2. Create the auth config

   In the `convex` folder create a new file `auth.config.ts` with the server-side configuration for validating access tokens.

   Paste in the `domain` and `clientId` values shown in *Install the Auth0 React SDK* step of the Auth0 quickstart or in your Auth0 application's Settings dashboard.

   convex/auth.config.ts

   TS

   ```
   import { AuthConfig } from "convex/server";

   export default {
     providers: [
       {
         domain: "your-domain.us.auth0.com",
         applicationID: "yourclientid",
       },
     ]
   } satisfies AuthConfig;
   ```

3. Deploy your changes

   Run `npx convex dev` to automatically sync your configuration to your backend.

   ```
   npx convex dev
   ```

4. Configure ConvexProviderWithAuth0

   Now replace your `ConvexProvider` with an `Auth0Provider` wrapping `ConvexProviderWithAuth0`. Add the `domain` and `clientId` as props to the `Auth0Provider`.

   Paste in the `domain` and `clientId` values shown in *Install the Auth0 React SDK* step of the Auth0 quickstart or in your Auth0 application's Settings dashboard as props to `Auth0Provider`.

   src/main.tsx

   TS

   ```
   import React from "react";
   import ReactDOM from "react-dom/client";
   import App from "./App";
   import "./index.css";
   import { ConvexReactClient } from "convex/react";
   import { ConvexProviderWithAuth0 } from "convex/react-auth0";
   import { Auth0Provider } from "@auth0/auth0-react";

   const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

   ReactDOM.createRoot(document.getElementById("root")!).render(
     <React.StrictMode>
       <Auth0Provider
         domain="your-domain.us.auth0.com"
         clientId="yourclientid"
         authorizationParams={{
           redirect_uri: window.location.origin,
         }}
         useRefreshTokens={true}
         cacheLocation="localstorage"
       >
         <ConvexProviderWithAuth0 client={convex}>
           <App />
         </ConvexProviderWithAuth0>
       </Auth0Provider>
     </React.StrictMode>,
   );
   ```

## Login and logout flows[​](#login-and-logout-flows "Direct link to Login and logout flows")

Now that you have everything set up, you can use the [`useAuth0()`](https://auth0.github.io/auth0-react/functions/useAuth0.html) hook to create login and logout buttons for your app.

The login button will redirect the user to the Auth0 universal login page. For details see [Add Login to Your Application](https://auth0.com/docs/quickstart/spa/react/interactive#add-login-to-your-application) in the Auth0 React Quickstart.

src/login.ts

TS

```
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginButton() {
  const { loginWithRedirect } = useAuth0();
  return <button onClick={loginWithRedirect}>Log in</button>;
}
```

The logout button will redirect the user to the Auth0 logout endpoint. For details see [Add Logout to your Application](https://auth0.com/docs/quickstart/spa/react/interactive#add-logout-to-your-application) in the Auth0 React Quickstart.

src/logout.ts

TS

```
import { useAuth0 } from "@auth0/auth0-react";

export default function LogoutButton() {
  const { logout } = useAuth0();
  return (
    <button
      onClick={() =>
        logout({ logoutParams: { returnTo: window.location.origin } })
      }
    >
      Log out
    </button>
  );
}
```

## Logged-in and logged-out views[​](#logged-in-and-logged-out-views "Direct link to Logged-in and logged-out views")

Use the [`useConvexAuth()`](/api/modules/react.md#useconvexauth) hook instead of the `useAuth0` hook when you need to check whether the user is logged in or not. The `useConvex` hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend:

src/App.ts

TS

```
import { useConvexAuth } from "convex/react";

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  return (
    <div className="App">
      {isAuthenticated ? "Logged in" : "Logged out or still loading"}
    </div>
  );
}
```

You can also use the `Authenticated`, `Unauthenticated` and `AuthLoading` helper components which use the `useConvexAuth` hook under the hood:

src/App.ts

TS

```
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

function App() {
  return (
    <div className="App">
      <Authenticated>Logged in</Authenticated>
      <Unauthenticated>Logged out</Unauthenticated>
      <AuthLoading>Still loading</AuthLoading>
    </div>
  );
}
```

## User information in React[​](#user-information-in-react "Direct link to User information in React")

You can access information about the authenticated user like their name from the `useAuth0` hook:

src/badge.ts

TS

```
import { useAuth0 } from "@auth0/auth0-react";

export default function Badge() {
  const { user } = useAuth0();
  return <span>Logged in as {user.name}</span>;
}
```

## User information in functions[​](#user-information-in-functions "Direct link to User information in functions")

See [Auth in Functions](/auth/functions-auth.md) to learn about how to access information about the authenticated user in your queries, mutations and actions.

See [Storing Users in the Convex Database](/auth/database-auth.md) to learn about how to store user information in the Convex database.

## Configuring dev and prod tenants[​](#configuring-dev-and-prod-tenants "Direct link to Configuring dev and prod tenants")

To configure a different Auth0 tenant (environment) between your Convex development and production deployments you can use environment variables configured on the Convex dashboard.

### Configuring the backend[​](#configuring-the-backend "Direct link to Configuring the backend")

First, change your `auth.config.ts` file to use environment variables:

convex/auth.config.ts

TS

```
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
  ],
} satisfies AuthConfig;
```

**Development configuration**

Open the Settings for your dev deployment on the Convex [dashboard](https://dashboard.convex.dev) and add the variables there:

![Convex dashboard dev deployment settings](/screenshots/auth0-convex-dashboard.png)

Now switch to the new configuration by running `npx convex dev`.

**Production configuration**

Similarly on the Convex [dashboard](https://dashboard.convex.dev) switch to your production deployment in the left side menu and set the values for your production Auth0 tenant there.

Now switch to the new configuration by running `npx convex deploy`.

### Configuring a React client[​](#configuring-a-react-client "Direct link to Configuring a React client")

To configure your client you can use environment variables as well. The exact name of the environment variables and the way to refer to them depends on each client platform (Vite vs Next.js etc.), refer to our corresponding [Quickstart](/quickstarts) or the relevant documentation for the platform you're using.

Change the props to `Auth0Provider` to take in environment variables:

src/main.tsx

TS

```
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { Auth0Provider } from "@auth0/auth0-react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <ConvexProviderWithAuth0 client={convex}>
        <App />
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  </React.StrictMode>,
);
```

**Development configuration**

Use the `.env.local` or `.env` file to configure your client when running locally. The name of the environment variables file depends on each client platform (Vite vs Next.js etc.), refer to our corresponding [Quickstart](/quickstarts) or the relevant documentation for the platform you're using:

.env.local

```
VITE_AUTH0_DOMAIN="your-domain.us.auth0.com"
VITE_AUTH0_CLIENT_ID="yourclientid"
```

**Production configuration**

Set the environment variables in your production environment depending on your hosting platform. See [Hosting](/production/hosting/.md).

## Debugging authentication[​](#debugging-authentication "Direct link to Debugging authentication")

If a user goes through the Auth0 login flow successfully, and after being redirected back to your page `useConvexAuth` gives `isAuthenticated: false`, it's possible that your backend isn't correctly configured.

The `auth.config.ts` file in your `convex/` directory contains a list of configured authentication providers. You must run `npx convex dev` or `npx convex deploy` after adding a new provider to sync the configuration to your backend.

For more thorough debugging steps, see [Debugging Authentication](/auth/debug.md).

## Under the hood[​](#under-the-hood "Direct link to Under the hood")

The authentication flow looks like this under the hood:

1. The user clicks a login button
2. The user is redirected to a page where they log in via whatever method you configure in
   <!-- -->
   Auth0
3. After a successful login
   <!-- -->
   Auth0
   <!-- -->
   redirects back to your page, or a different page which you configure via
   <!-- -->
   the
   <!-- -->
   [`authorizationParams`](https://auth0.github.io/auth0-react/interfaces/AuthorizationParams.html)
   <!-- -->
   prop
   <!-- -->
   .
4. The `Auth0Provider` now knows that the user is authenticated.
5. The `ConvexProviderWithAuth0` fetches an auth token from
   <!-- -->
   Auth0
   <!-- -->
   .
6. The `ConvexReactClient` passes this token down to your Convex backend to validate
7. Your Convex backend retrieves the public key from
   <!-- -->
   Auth0
   <!-- -->
   to check that the token's signature is valid.
8. The `ConvexReactClient` is notified of successful authentication, and `ConvexProviderWithAuth0` now knows that the user is authenticated with Convex. `useConvexAuth` returns `isAuthenticated: true` and the `Authenticated` component renders its children.

`ConvexProviderWithAuth0` takes care of refetching the token when needed to make sure the user stays authenticated with your backend.
