import {
    useEffect,
    useState,
} from 'react';
import { i18n } from '#i18n';

import {
    browser,
} from 'wxt/browser';

import TranslatorPanel
    from '@/components/TranslatorPanel';

import {
    toTranslatorPageContext,
} from '@/components/translator/state';

import {
    getActiveTab,
} from './active-tab';

import {
    classifyActiveTab,
    type PopupPageState,
} from './state';

function App() {
    const [page, setPage] =
        useState<PopupPageState>({
            status: 'loading',
        });

    useEffect(() => {
        let active = true;

        getActiveTab()
            .then((tab) => {
                if (active) {
                    setPage(
                        classifyActiveTab(tab),
                    );
                }
            })
            .catch(() => {
                if (active) {
                    setPage({
                        status: 'error',
                        messageKey: 'popup.activeTabError',
                    });
                }
            });

        return () => {
            active = false;
        };
    }, []);

    if (page.status === 'loading') {
        return (
            <main className="ct-panel">
                <h1>
                    {i18n.t('translator.title')}
                </h1>

                <p role="status">
                    {i18n.t('popup.checking')}
                </p>
            </main>
        );
    }

    if (page.status === 'cookidoo') {
        return (
            <main className="ct-panel">
                <h1>
                    {i18n.t('translator.title')}
                </h1>

                <p>
                    {i18n.t('popup.openRecipe')}
                </p>
            </main>
        );
    }

    if (page.status === 'other') {
        return (
            <main className="ct-panel">
                <h1>
                    {i18n.t('translator.title')}
                </h1>

                <p>
                    {i18n.t('popup.unsupportedPage')}
                </p>
            </main>
        );
    }

    if (page.status === 'error') {
        return (
            <main className="ct-panel">
                <h1>
                    {i18n.t('translator.title')}
                </h1>

                <p
                    role="alert"
                    className="error"
                >
                    {i18n.t(page.messageKey)}
                </p>
            </main>
        );
    }

    const translatorPage =
        toTranslatorPageContext(
            page.pageInfo,
        );

    if (!translatorPage) {
        return (
            <main className="ct-panel">
                <h1>
                    {i18n.t('translator.title')}
                </h1>

                <p role="alert">
                    {i18n.t('popup.recipeInfoUnavailable')}
                </p>
            </main>
        );
    }

    return (
        <main className="ct-app">
            <h1>
                {i18n.t('translator.title')}
            </h1>

            <TranslatorPanel
                page={translatorPage}
                onReload={() => {
                    void browser.tabs.reload(
                        page.tabId,
                    );
                }}
                onOpenCreatedRecipe={(
                    url,
                ) => {
                    void browser.tabs.update(
                        page.tabId,
                        {
                            url,
                        },
                    );
                }}
                onSignIn={(url) => {
                    void browser.tabs.update(
                        page.tabId,
                        {url},
                    );
                }}
            />
        </main>
    );
}

export default App;
