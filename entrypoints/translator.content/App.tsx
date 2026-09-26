import { useCallback, useEffect, useRef, useState } from "react";
import { i18n } from "#i18n";

import TranslatorPanel from "@/components/TranslatorPanel";
import { toTranslatorPageContext } from "@/components/translator/state";
import { detectCookidooPage } from "@/lib/cookidoo/page";

export default function App() {
  const [url, setUrl] = useState(location.href);

  const [open, setOpen] = useState(false);

  const [running, setRunning] = useState(false);

  const fab = useRef<HTMLButtonElement>(null);

  const dialog = useRef<HTMLDivElement>(null);

  const pageInfo = detectCookidooPage(url);

  const page = toTranslatorPageContext(pageInfo);

  const close = useCallback(() => {
    if (running) {
      return;
    }

    setOpen(false);

    requestAnimationFrame(() => {
      fab.current?.focus();
    });
  }, [running]);

  /*
   * Keep the content script mounted on all
   * Cookidoo pages and react to SPA navigation.
   *
   * History mutations in the page MAIN world
   * do not reliably emit an event in the
   * extension isolated world, so use popstate /
   * hashchange plus a lightweight URL check.
   */
  useEffect(() => {
    let previousUrl = location.href;

    const update = () => {
      const nextUrl = location.href;

      if (nextUrl === previousUrl) {
        return;
      }

      previousUrl = nextUrl;

      setUrl(nextUrl);
    };

    const interval = window.setInterval(update, 1000);

    window.addEventListener("popstate", update);

    window.addEventListener("hashchange", update);

    return () => {
      window.clearInterval(interval);

      window.removeEventListener("popstate", update);

      window.removeEventListener("hashchange", update);
    };
  }, []);

  /*
   * A modal belongs to the current recipe.
   * Close it if navigation leaves the
   * supported recipe routes.
   */
  useEffect(() => {
    if (page) {
      return;
    }

    setOpen(false);
    setRunning(false);
  }, [page]);

  /*
   * Focus management and a lightweight
   * focus trap inside the Shadow DOM.
   */
  useEffect(() => {
    if (!open || !page) {
      return;
    }

    const node = dialog.current;

    if (!node) {
      return;
    }

    const getFocusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          [
            "button:not(:disabled)",
            "select:not(:disabled)",
            "a[href]",
            '[tabindex]:not([tabindex="-1"])',
          ].join(","),
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

    getFocusable()[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!running) {
          event.preventDefault();
          close();
        }

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0]!;

      const last = focusable[focusable.length - 1]!;

      const root = node.getRootNode();

      const activeElement =
        root instanceof ShadowRoot
          ? root.activeElement
          : document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", handleKey);

    return () => {
      node.removeEventListener("keydown", handleKey);
    };
  }, [open, page, running, close]);

  if (!page) {
    return null;
  }

  return (
    <div className="ct-app">
      <button
        ref={fab}
        type="button"
        className="ct-fab"
        aria-label={i18n.t("translator.actions.open")}
        title={i18n.t("translator.title")}
        onClick={() => setOpen(true)}
        hidden={open}
      >
        <svg
          aria-hidden="true"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />

          <path
            d="
              M3 12h18
              M12 3
              c2.5 2.5 3.5 5.5 3.5 9
              s-1 6.5-3.5 9
              c-2.5-2.5-3.5-5.5-3.5-9
              s1-6.5 3.5-9Z
            "
          />
        </svg>
      </button>

      {open && (
        <div
          className="ct-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !running) {
              close();
            }
          }}
        >
          <div
            ref={dialog}
            className="ct-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ct-dialog-title"
          >
            <header className="ct-header">
              <h2 id="ct-dialog-title">{i18n.t("translator.modal.title")}</h2>

              <button
                type="button"
                className="ct-close"
                aria-label={i18n.t("translator.actions.closeDialog")}
                disabled={running}
                onClick={close}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <TranslatorPanel
              page={page}
              onCancel={close}
              onRunningChange={setRunning}
              onReload={() => {
                window.location.reload();
              }}
              onOpenCreatedRecipe={(recipeUrl) => {
                window.location.assign(recipeUrl);
              }}
              onSignIn={(loginUrl) => {
                window.location.assign(loginUrl);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
