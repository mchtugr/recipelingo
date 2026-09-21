import {
    useEffect,
    useState,
} from 'react';

import {
    browser,
} from 'wxt/browser';

import TranslatorPanel
    from '../../components/TranslatorPanel';

import {
    toTranslatorPageContext,
} from '../../components/translator/state';

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
                        message:
                            'Etkin sekme kontrol edilemedi.',
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
                    Cookidoo Translator
                </h1>

                <p role="status">
                    Tarif kontrol ediliyor…
                </p>
            </main>
        );
    }

    if (page.status === 'cookidoo') {
        return (
            <main className="ct-panel">
                <h1>
                    Cookidoo Translator
                </h1>

                <p>
                    Bir Cookidoo tarif
                    sayfası açın.
                </p>
            </main>
        );
    }

    if (page.status === 'other') {
        return (
            <main className="ct-panel">
                <h1>
                    Cookidoo Translator
                </h1>

                <p>
                    Cookidoo Translator'ı
                    kullanmak için Cookidoo'da
                    bir tarif açın.
                </p>
            </main>
        );
    }

    if (page.status === 'error') {
        return (
            <main className="ct-panel">
                <h1>
                    Cookidoo Translator
                </h1>

                <p
                    role="alert"
                    className="error"
                >
                    {page.message}
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
                    Cookidoo Translator
                </h1>

                <p role="alert">
                    Tarif bilgileri
                    okunamadı.
                </p>
            </main>
        );
    }

    return (
        <main className="ct-app">
            <h1>
                Cookidoo Translator
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
            />
        </main>
    );
}

export default App;