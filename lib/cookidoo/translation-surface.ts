import type { CookidooPageInfo } from "./page";

export type TranslationSurface = "none" | "inline" | "fab";

export type InlineTriggerPageType = "public-recipe" | "created-recipe";

export const INLINE_TRIGGER_BUTTON_TYPE = "button" as const;
export const INLINE_ACTION_ROW_ATTRIBUTE = "data-recipelingo-action-row";

export function getInlineTriggerMessageKey(pageType: InlineTriggerPageType) {
  return pageType === "public-recipe"
    ? "translator.actions.importAndTranslate"
    : "translator.actions.translate";
}

const ACTION_CONTAINER_SELECTORS = [
  '[data-testid="recipe-actions"]',
  '[data-testid="recipe-summary-actions"]',
  '[data-testid="recipe-summary"]',
  '[data-test="recipe-actions"]',
  '[data-qa="recipe-actions"]',
  '[data-testid*="recipe-action"]',
  '[data-testid*="recipe-summary"]',
  '[data-test*="recipe-action"]',
  '[data-qa*="recipe-action"]',
];

/**
 * Finds a stable Cookidoo action area. The route classifier remains the source
 * of truth for recipe type; these DOM signals only choose placement.
 */
export function findTranslationAnchor(
  root: ParentNode = document,
): HTMLElement | null {
  const recipeForms = Array.from(
    root.querySelectorAll<HTMLElement>(
      'form[action*="/planning/"][action*="/api/my-day"]',
    ),
  ).filter((form) => form.querySelector('[name="recipeIds"]'));

  if (recipeForms[0]) {
    return recipeForms[0];
  }

  const loggedOutFooter = root.querySelector<HTMLElement>(
    "#main-content recipe-card .recipe-card__footer",
  );

  if (loggedOutFooter?.querySelector('a[href*="/ciam/register/start"]')) {
    return loggedOutFooter;
  }

  for (const selector of ACTION_CONTAINER_SELECTORS) {
    const container = root.querySelector(selector);
    if (container instanceof HTMLElement) {
      return container;
    }
  }

  return null;
}

/** Append beside the native CTA without changing form controls or behavior. */
export function appendInlineUiAfterNativeAction(
  anchor: Element,
  ui: Element,
): void {
  if (!(anchor instanceof HTMLElement) || !(ui instanceof HTMLElement)) {
    anchor.append(ui);
    return;
  }

  const nativeAction = anchor.matches("form")
    ? anchor.querySelector<HTMLElement>(
        'button[type="submit"], button.button--primary, input[type="submit"]',
      )
    : anchor.querySelector<HTMLElement>('a[href*="/ciam/register/start"]');

  if (nativeAction) {
    nativeAction.insertAdjacentElement("afterend", ui);
    return;
  }

  anchor.append(ui);
}

export function isCreatedRecipeEditMode(url: string | URL): boolean {
  try {
    const parsedUrl = typeof url === "string" ? new URL(url) : url;
    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    return (
      segments.length === 4 &&
      segments[0] === "created-recipes" &&
      segments[3] === "edit"
    );
  } catch {
    return false;
  }
}

export function resolveTranslationSurface(
  page: CookidooPageInfo,
  options: { hasInlineAnchor: boolean; isEditMode?: boolean },
): TranslationSurface {
  if (page.type !== "public-recipe" && page.type !== "created-recipe") {
    return "none";
  }

  if (page.type === "created-recipe" && options.isEditMode) {
    return "fab";
  }

  return options.hasInlineAnchor ? "inline" : "fab";
}
