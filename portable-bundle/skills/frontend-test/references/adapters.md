# Stack adapters

Choose the adapter from verified project configuration.

## Umi and React

Reuse Jest when configured. Resolve Umi-generated paths, aliases, ESM transforms, CSS/assets, providers, router, i18n, and request clients. Confirm test discovery does not exclude business entry modules. Use Playwright for long browser and host journeys.

## Vite and React

Use the existing runner. Add Vitest only after verifying compatibility with the actual Vite, Node, TypeScript, and React versions, then lock it. Avoid broad config replacement.

## Angular 10–14

Retain meaningful Jasmine/Karma tests after fixing only proven missing test assets or configuration. Do not use Protractor for new coverage. Build the legacy app with its compatible runtime and connect an independent modern Playwright runner to its URL.

## Shared components and SDKs

Validate source logic, build/type declarations/exports/styles/assets, packed artifact contents, installation of the exact candidate, and representative real consumers. Record tarball or package digest and installed version. Test deep dist imports, peers, duplicate framework instances, themes/locales, and backward compatibility.

## Host and micro-apps

Test standalone child behavior separately from real-host mounting. Verify route synchronization, events, auth/tenant/time context, back/forward, refresh, remount, cleanup, and pinned participating application and backend versions.

## API and schema tools

Use MSW for components and Playwright route for browser mocks without stacking opaque interceptors. OpenAPI diff or Schemathesis can check schema drift and generated edge cases. Pact is complete only when provider verification runs. These tools do not provide product semantics without an Oracle.
