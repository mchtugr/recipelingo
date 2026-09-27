import ReactDOM, { type Root } from "react-dom/client";

import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import { COOKIDOO_HOSTS } from "@/lib/cookidoo/domains";
import { getUiLocale, setUiLocale } from "@/lib/ui-locale";

import App, { InlineTrigger, SURFACE_EVENT } from "./App";

import { detectCookidooPage } from "@/lib/cookidoo/page";
import {
  appendInlineUiAfterNativeAction,
  findTranslationAnchor,
  INLINE_ACTION_ROW_ATTRIBUTE,
  isCreatedRecipeEditMode,
  resolveTranslationSurface,
} from "@/lib/cookidoo/translation-surface";

import "./style.css";

export default defineContentScript({
  matches: COOKIDOO_HOSTS.map((hostname) => `https://${hostname}/*` as const),

  cssInjectionMode: "ui",

  async main(ctx) {
    await setUiLocale(document.documentElement.lang);
    const actionRowStyle = document.createElement("style");
    actionRowStyle.setAttribute("data-recipelingo-action-row-style", "");
    actionRowStyle.textContent = `
      [data-recipelingo-action-row] {
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        gap: 16px;
      }

      @media (max-width: 767px) {
        [data-recipelingo-action-row] > button,
        [data-recipelingo-action-row] > a[href*="/ciam/register/start"] {
          flex: 1 1 100%;
          width: 100%;
        }
      }
    `;
    (document.head ?? document.documentElement).append(actionRowStyle);

    let inlineActionRowContainer: HTMLElement | null = null;

    const fabUi = await createShadowRootUi(ctx, {
      name: "recipelingo-ui",

      position: "overlay",

      anchor: "body",

      zIndex: 2147483000,

      isolateEvents: [
        "keydown",
        "keyup",
        "keypress",
        "click",
        "mousedown",
        "mouseup",
        "pointerdown",
        "pointerup",
      ],

      onMount(container, _shadow, host) {
        host.setAttribute("data-recipelingo-fab-root", "");
        const pageFontFamily = getComputedStyle(document.body).fontFamily;

        host.style.setProperty(
          "--ct-font-family",
          pageFontFamily || "Arial, Helvetica, sans-serif",
        );

        const element = document.createElement("div");

        container.append(element);

        const root = ReactDOM.createRoot(element);

        root.render(<App />);

        return root;
      },

      onRemove(root) {
        root?.unmount();
      },
    });

    fabUi.mount();

    const inlineUi = await createShadowRootUi<Root>(ctx, {
      name: "recipelingo-inline-ui",
      position: "inline",
      anchor: () => findTranslationAnchor(),
      append: appendInlineUiAfterNativeAction,
      isolateEvents: [
        "keydown",
        "keyup",
        "keypress",
        "click",
        "mousedown",
        "mouseup",
        "pointerdown",
        "pointerup",
      ],
      onMount(container, _shadow, host) {
        host.setAttribute("data-recipelingo-inline-root", "");
        const actionRow = host.parentElement?.matches(
          "form, .recipe-card__footer",
        )
          ? host.parentElement
          : null;
        inlineActionRowContainer = actionRow;
        actionRow?.setAttribute(INLINE_ACTION_ROW_ATTRIBUTE, "");
        const pageInfo = detectCookidooPage(location.href);
        const element = document.createElement("div");
        container.append(element);
        const root = ReactDOM.createRoot(element);

        if (
          pageInfo.type === "public-recipe" ||
          pageInfo.type === "created-recipe"
        ) {
          root.render(<InlineTrigger pageType={pageInfo.type} />);
        }

        return root;
      },
      onRemove(root) {
        root?.unmount();
        inlineActionRowContainer?.removeAttribute(INLINE_ACTION_ROW_ATTRIBUTE);
        inlineActionRowContainer = null;
      },
    });

    let mountedAnchor: HTMLElement | null = null;
    let previousUrl = location.href;
    let reconcileTimer: number | undefined;

    const publishSurface = (inline: boolean) => {
      window.dispatchEvent(
        new CustomEvent(SURFACE_EVENT, { detail: { inline } }),
      );
    };

    const reconcileTranslationSurface = async () => {
      const previousUiLocale = getUiLocale();
      await setUiLocale(document.documentElement.lang);
      if (previousUiLocale !== getUiLocale() && mountedAnchor) {
        inlineUi.remove();
        mountedAnchor = null;
      }

      const page = detectCookidooPage(location.href);
      const anchor = findTranslationAnchor();
      const surface = resolveTranslationSurface(page, {
        hasInlineAnchor: anchor !== null,
        isEditMode: isCreatedRecipeEditMode(location.href),
      });

      if (surface === "inline" && anchor) {
        if (mountedAnchor !== anchor) {
          if (mountedAnchor) {
            inlineUi.remove();
          }

          mountedAnchor = anchor;
          inlineUi.mount();
        }
      } else if (mountedAnchor) {
        inlineUi.remove();
        mountedAnchor = null;
      }

      publishSurface(surface === "inline");
    };

    const scheduleReconcile = () => {
      if (reconcileTimer !== undefined) {
        window.clearTimeout(reconcileTimer);
      }

      reconcileTimer = window.setTimeout(() => {
        reconcileTimer = undefined;
        void reconcileTranslationSurface();
      }, 100);
    };

    const checkUrl = () => {
      if (location.href !== previousUrl) {
        previousUrl = location.href;
      }

      scheduleReconcile();
    };

    const observer = new MutationObserver(scheduleReconcile);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("popstate", checkUrl);
    window.addEventListener("hashchange", checkUrl);
    const interval = window.setInterval(checkUrl, 1000);

    void reconcileTranslationSurface();

    ctx.onInvalidated(() => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("popstate", checkUrl);
      window.removeEventListener("hashchange", checkUrl);
      if (reconcileTimer !== undefined) {
        window.clearTimeout(reconcileTimer);
      }
      inlineUi.remove();
      mountedAnchor = null;
      actionRowStyle.remove();
    });
  },
});
