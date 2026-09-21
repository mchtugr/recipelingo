export class CookidooAuthenticationError extends Error {
  constructor() {
    super("Cookidoo authentication is required");
    this.name = "CookidooAuthenticationError";
  }
}
