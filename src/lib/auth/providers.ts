/**
 * Open access (beta testing): no sign-in at all, every visitor uses the demo account and workspace.
 * On by default; set BETA_REQUIRE_LOGIN=true to require sign-in again.
 */
export function openAccess(): boolean {
  return process.env.BETA_REQUIRE_LOGIN !== "true";
}

/** Which sign-in options are configured. Providers whose env vars are missing are hidden. */
export function enabledProviders() {
  return {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    microsoft: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET),
    password: true,
    demo: demoLoginEnabled(),
  };
}

export function demoLoginEnabled(): boolean {
  const v = process.env.BETA_DEMO_LOGIN;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV === "development";
}
