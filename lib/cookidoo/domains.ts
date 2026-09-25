export const COOKIDOO_HOSTS = [
  "cookidoo.at",
  "cookidoo.be",
  "cookidoo.ca",
  "cookidoo.ch",
  "cookidoo.com.cn",
  "cookidoo.co.uk",
  "cookidoo.com.au",
  "cookidoo.com.tr",
  "cookidoo.cz",
  "cookidoo.de",
  "cookidoo.es",
  "cookidoo.fr",
  "cookidoo.gr",
  "cookidoo.international",
  "cookidoo.it",
  "cookidoo.mx",
  "cookidoo.pl",
  "cookidoo.pt",
  "cookidoo.thermomix.com",
  "cookidoo.thermomix.vn",
  "cookidoo.tw",
] as const;

const COOKIDOO_HOST_SET = new Set<string>(COOKIDOO_HOSTS);

export function isCookidooHostname(hostname: string): boolean {
  return COOKIDOO_HOST_SET.has(hostname.toLowerCase());
}
