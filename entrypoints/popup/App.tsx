import { useEffect, useState, type ReactNode } from "react";
import { i18n } from "#i18n";

import { browser } from "wxt/browser";

import TranslatorPanel from "@/components/TranslatorPanel";

import { toTranslatorPageContext } from "@/components/translator/state";

import { getActiveTab } from "./active-tab";

import { classifyActiveTab, type PopupPageState } from "./state";

function PopupHeader() {
  return (
    <header className="popup-header">
      <img
        className="popup-brand-icon"
        src="/icon/48.png"
        alt=""
        aria-hidden="true"
      />
      <div>
        <h1 id="popup-title">{i18n.t("translator.title")}</h1>
        <p>{i18n.t("popup.tagline")}</p>
      </div>
    </header>
  );
}

function PopupState({
  title,
  children,
  role,
  tone,
}: {
  title: string;
  children: ReactNode;
  role?: "alert" | "status";
  tone?: "error";
}) {
  return (
    <section className={`popup-state${tone ? ` popup-state-${tone}` : ""}`}>
      <h2>{title}</h2>
      <p role={role}>{children}</p>
    </section>
  );
}

function App() {
  const [page, setPage] = useState<PopupPageState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    getActiveTab()
      .then((tab) => {
        if (active) {
          setPage(classifyActiveTab(tab));
        }
      })
      .catch(() => {
        if (active) {
          setPage({
            status: "error",
            messageKey: "popup.activeTabError",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (page.status === "loading") {
    return (
      <main className="popup-shell" aria-labelledby="popup-title">
        <PopupHeader />
        <PopupState title={i18n.t("popup.checkingTitle")} role="status">
          {i18n.t("popup.checking")}
        </PopupState>
      </main>
    );
  }

  if (page.status === "cookidoo") {
    return (
      <main className="popup-shell" aria-labelledby="popup-title">
        <PopupHeader />
        <PopupState title={i18n.t("popup.openRecipeTitle")}>
          {i18n.t("popup.openRecipe")}
        </PopupState>
      </main>
    );
  }

  if (page.status === "other") {
    return (
      <main className="popup-shell" aria-labelledby="popup-title">
        <PopupHeader />
        <PopupState title={i18n.t("popup.unsupportedPageTitle")}>
          {i18n.t("popup.unsupportedPage")}
        </PopupState>
      </main>
    );
  }

  if (page.status === "error") {
    return (
      <main className="popup-shell" aria-labelledby="popup-title">
        <PopupHeader />
        <PopupState
          title={i18n.t("popup.errorTitle")}
          role="alert"
          tone="error"
        >
          {i18n.t(page.messageKey)}
        </PopupState>
      </main>
    );
  }

  const translatorPage = toTranslatorPageContext(page.pageInfo);

  if (!translatorPage) {
    return (
      <main className="popup-shell" aria-labelledby="popup-title">
        <PopupHeader />
        <PopupState
          title={i18n.t("popup.errorTitle")}
          role="alert"
          tone="error"
        >
          {i18n.t("popup.recipeInfoUnavailable")}
        </PopupState>
      </main>
    );
  }

  return (
    <main className="popup-shell" aria-labelledby="popup-title">
      <PopupHeader />

      <section className="popup-context" aria-labelledby="popup-context-title">
        <div className="popup-context-marker" aria-hidden="true" />
        <div>
          <h2 id="popup-context-title">{i18n.t("popup.readyTitle")}</h2>
          <p>
            {i18n.t(
              page.status === "public-recipe"
                ? "popup.publicRecipe"
                : "popup.createdRecipe",
            )}
          </p>
        </div>
      </section>

      <TranslatorPanel
        page={translatorPage}
        onReload={() => {
          void browser.tabs.reload(page.tabId);
        }}
        onOpenCreatedRecipe={(url) => {
          void browser.tabs.update(page.tabId, {
            url,
          });
        }}
        onSignIn={(url) => {
          void browser.tabs.update(page.tabId, { url });
        }}
      />
    </main>
  );
}

export default App;
