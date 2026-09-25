import { isCookidooHostname } from "./domains.ts";

export interface CookidooLoginUrlOptions {
  hostname: string;
  locale: string;
  redirectAfterLogin: string;
}

export function createCookidooLoginUrl({
  hostname,
  locale,
  redirectAfterLogin,
}: CookidooLoginUrlOptions): string {
  if (!isCookidooHostname(hostname)) {
    throw new Error(`Unsupported Cookidoo hostname: ${hostname}`);
  }

  const cookidooOrigin = new URL(`https://${hostname}`).origin;

  if (
    !redirectAfterLogin.startsWith("/") ||
    new URL(redirectAfterLogin, cookidooOrigin).origin !== cookidooOrigin
  ) {
    throw new Error("Cookidoo login redirect must be a same-site path");
  }

  return (
    `${cookidooOrigin}/profile/${encodeURIComponent(locale)}/login` +
    `?redirectAfterLogin=${encodeURIComponent(redirectAfterLogin)}`
  );
}
