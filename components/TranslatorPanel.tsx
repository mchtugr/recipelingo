import {
    useEffect,
    useState,
} from 'react';

import {
    CookidooClient,
} from '../lib/cookidoo/client';

import {
    translateCreatedRecipe,
} from '../lib/translation/translate-created-recipe';

import {
    createAndTranslatePublicRecipe,
    PublicRecipeTranslationError,
    type PublicRecipeTranslationProgress,
} from '../lib/translation/create-and-translate-public-recipe';

import {
    getPublicRecipeTranslationInput,
    getTranslationErrorMessage,
    type TranslatorPageContext,
} from './translator/state';
import {
    resolveTargetLanguage,
    SUPPORTED_TARGET_LANGUAGES,
    TRANSLATION_LANGUAGES,
    type SourceLanguage,
    type SupportedTargetLanguage,
} from '../lib/translation/languages';
import {
    getTargetLanguagePreference,
    setTargetLanguagePreference,
} from '../lib/translation/preferences';

type TranslationUiState =
    | {
    status: 'idle';
}
    | {
    status: 'running';
    progress:
        PublicRecipeTranslationProgress;
    downloadPercent?: number;
}
    | {
    status: 'success';
    createdRecipeId?: string;
}
    | {
    status: 'error';
    message: string;
    createdRecipeId?: string;
};

export interface TranslatorPanelProps {
    page: TranslatorPageContext;

    onCancel?: () => void;

    onReload?: () => void;

    onOpenCreatedRecipe?: (
        url: string,
    ) => void;

    onRunningChange?: (
        running: boolean,
    ) => void;
}

function progressMessage(
    progress:
    PublicRecipeTranslationProgress,
): string {
    switch (progress.stage) {
        case 'creating':
            return (
                'Created Recipe oluşturuluyor…'
            );

        case 'loading':
            return 'Tarif yükleniyor…';

        case 'detecting-language':
            return 'Tarif dili algılanıyor…';

        case 'translating-metadata':
            return (
                'Tarif bilgileri çevriliyor…'
            );

        case 'translating-instructions': {
            const count =
                progress.current !== undefined &&
                progress.total !== undefined &&
                progress.current > 0
                    ? ` ${progress.current} / ${progress.total}`
                    : '';

            return (
                `Adımlar çevriliyor…${count}`
            );
        }

        case 'saving-metadata':
            return (
                'Tarif bilgileri kaydediliyor…'
            );

        case 'saving-instructions':
            return (
                'Adımlar kaydediliyor…'
            );

        case 'complete':
            return (
                'Çeviri tamamlanıyor…'
            );
    }
}

function instructionProgressPercent(
    progress:
    PublicRecipeTranslationProgress,
): number | undefined {
    if (
        progress.stage !==
        'translating-instructions' ||
        progress.current === undefined ||
        progress.total === undefined ||
        progress.total <= 0
    ) {
        return undefined;
    }

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(
                (
                    progress.current /
                    progress.total
                ) * 100,
            ),
        ),
    );
}

function createCreatedRecipeUrl(
    page: TranslatorPageContext,
    recipeId: string,
): string {
    return (
        `https://${page.hostname}` +
        '/created-recipes/' +
        `${encodeURIComponent(
            page.locale,
        )}/` +
        `${encodeURIComponent(
            recipeId,
        )}/edit`
    );
}

function TranslatorPanel({
                             page,
                             onCancel,
                             onReload,
                             onOpenCreatedRecipe,
                             onRunningChange,
                         }: TranslatorPanelProps) {
    const [
        sourceLanguage,
        setSourceLanguage,
    ] = useState<SourceLanguage>('auto');

    const [
        targetLanguage,
        setTargetLanguage,
    ] = useState<SupportedTargetLanguage | null>(null);

    const [
        translation,
        setTranslation,
    ] = useState<TranslationUiState>({
        status: 'idle',
    });

    const isRunning =
        translation.status === 'running';

    useEffect(() => {
        onRunningChange?.(
            isRunning,
        );
    }, [
        isRunning,
        onRunningChange,
    ]);

    useEffect(() => {
        let active = true;
        setTargetLanguage(null);
        void getTargetLanguagePreference()
            .catch(() => undefined)
            .then((savedTargetLanguage) => {
                if (active) {
                    setTargetLanguage(resolveTargetLanguage({
                        locale: page.locale,
                        savedTargetLanguage,
                    }));
                }
            });
        return () => {
            active = false;
        };
    }, [page.locale]);

    async function handleTranslate() {
        if (
            translation.status !==
            'idle' ||
            targetLanguage === null
        ) {
            return;
        }

        const client =
            new CookidooClient({
                hostname: page.hostname,
                locale: page.locale,
            });

        const isPublic =
            page.type ===
            'public-recipe';

        const publicInput =
            getPublicRecipeTranslationInput(
                page,
                sourceLanguage,
                targetLanguage,
            );

        if (
            isPublic &&
            !publicInput
        ) {
            return;
        }

        setTranslation({
            status: 'running',
            progress: {
                stage: isPublic
                    ? 'creating'
                    : 'loading',
            },
        });

        const sharedOptions = {
            sourceLanguage,
            targetLanguage,

            onProgress: (
                progress:
                PublicRecipeTranslationProgress,
            ) => {
                setTranslation(
                    (current) =>
                        current.status ===
                        'running'
                            ? {
                                ...current,
                                progress,
                            }
                            : current,
                );
            },

            onDownloadProgress: ({
                                     percent,
                                 }: {
                percent: number;
            }) => {
                setTranslation(
                    (current) =>
                        current.status ===
                        'running'
                            ? {
                                ...current,
                                downloadPercent:
                                percent,
                            }
                            : current,
                );
            },
        } satisfies Pick<
            Parameters<
                typeof createAndTranslatePublicRecipe
            >[1],
            | 'sourceLanguage'
            | 'targetLanguage'
            | 'onProgress'
            | 'onDownloadProgress'
        >;

        try {
            if (isPublic) {
                if (!publicInput) {
                    return;
                }

                const result =
                    await createAndTranslatePublicRecipe(
                        client,
                        {
                            publicRecipeId:
                            publicInput.publicRecipeId,

                            ...sharedOptions,

                            sourceLanguage:
                            publicInput.sourceLanguage,

                            targetLanguage:
                            publicInput.targetLanguage,
                        },
                    );

                setTranslation({
                    status: 'success',
                    createdRecipeId:
                    result.createdRecipeId,
                });

                return;
            }

            await translateCreatedRecipe(
                client,
                {
                    recipeId:
                    page.recipeId,

                    ...sharedOptions,
                },
            );

            setTranslation({
                status: 'success',
            });
        } catch (error) {
            if (
                error instanceof
                PublicRecipeTranslationError
            ) {
                setTranslation({
                    status: 'error',

                    message:
                        getTranslationErrorMessage(
                            error.cause,
                        ),

                    createdRecipeId:
                    error.createdRecipeId,
                });

                return;
            }

            setTranslation({
                status: 'error',

                message: isPublic
                    ? (
                        'Tarif Cookidoo’ya eklenemedi. ' +
                        'Lütfen tekrar deneyin.'
                    )
                    : getTranslationErrorMessage(
                        error,
                    ),
            });
        }
    }

    function handleSourceChange(
        value: string,
    ) {
        setSourceLanguage(value as SourceLanguage);

        setTranslation({
            status: 'idle',
        });
    }

    function handleTargetChange(value: string) {
        const language = value as SupportedTargetLanguage;
        setTargetLanguage(language);
        setTranslation({status: 'idle'});
        void setTargetLanguagePreference(language).catch(() => {
            // The in-memory selection remains usable when extension storage fails.
        });
    }

    const canTranslate =
        translation.status ===
        'idle' &&
        targetLanguage !== null;

    const createdRecipeUrl =
        (
            translation.status ===
            'success' ||
            translation.status === 'error'
        ) &&
        translation.createdRecipeId
            ? createCreatedRecipeUrl(
                page,
                translation.createdRecipeId,
            )
            : undefined;

    function renderIdle() {
        return (
            <div className="ct-view">
                <p className="ct-intro">
                    {page.type ===
                    'created-recipe'
                        ? (
                            'Bu Created Recipe ' +
                            'çevrilebilir.'
                        )
                        : (
                            'Bu Cookidoo tarifi ' +
                            'Created Recipe olarak ' +
                            'oluşturulup çevrilebilir.'
                        )}
                </p>

                <div className="fields">
                    <div className="field">
                        <label
                            htmlFor="source-language"
                        >
                            Tarif dili
                        </label>

                        <select
                            id="source-language"
                            value={sourceLanguage}
                            onChange={(event) => {
                                handleSourceChange(
                                    event.target.value,
                                );
                            }}
                        >
                            <option value="auto">
                                Otomatik algıla
                            </option>

                            {TRANSLATION_LANGUAGES.map(
                                ({code, label}) => (
                                    <option
                                        key={code}
                                        value={code}
                                    >
                                        {label}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    <div className="field">
                        <label
                            htmlFor="target-language"
                        >
                            Hedef dil
                        </label>

                        <select
                            id="target-language"
                            value={targetLanguage ?? ''}
                            disabled={targetLanguage === null || isRunning}
                            onChange={(event) => {
                                handleTargetChange(event.target.value);
                            }}
                        >
                            {targetLanguage === null && <option value="">Yükleniyor…</option>}
                            {SUPPORTED_TARGET_LANGUAGES.map((code) => {
                                const language = TRANSLATION_LANGUAGES.find((item) => item.code === code);
                                return <option key={code} value={code}>{language?.label ?? code}</option>;
                            })}
                        </select>
                    </div>
                </div>

                <div className="actions">
                    {onCancel && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={onCancel}
                        >
                            İptal
                        </button>
                    )}

                    <button
                        type="button"
                        className="primary"
                        disabled={
                            !canTranslate
                        }
                        onClick={() => {
                            void handleTranslate();
                        }}
                    >
                        {page.type ===
                        'public-recipe'
                            ? 'Oluştur ve çevir'
                            : 'Tarifi çevir'}
                    </button>
                </div>
            </div>
        );
    }

    function renderRunning(
        state: Extract<
            TranslationUiState,
            {
                status: 'running';
            }
        >,
    ) {
        const percent =
            instructionProgressPercent(
                state.progress,
            );

        return (
            <section
                className="
          ct-state
          ct-state-running
        "
                role="status"
                aria-live="polite"
            >
                <div
                    className="
            ct-state-icon
            ct-state-icon-progress
          "
                    aria-hidden="true"
                >
          <span
              className="ct-spinner"
          />
                </div>

                <h3 className="ct-state-title">
                    Tarif çevriliyor…
                </h3>

                <p
                    className="
            ct-state-description
          "
                >
                    {progressMessage(
                        state.progress,
                    )}
                </p>

                <div className="ct-progress">
                    <div
                        className="
              ct-progress-track
            "
                        role="progressbar"
                        aria-label={
                            percent === undefined
                                ? 'Çeviri ilerlemesi'
                                : (
                                    'Çeviri ilerlemesi: ' +
                                    `yüzde ${percent}`
                                )
                        }
                        aria-valuemin={
                            percent === undefined
                                ? undefined
                                : 0
                        }
                        aria-valuemax={
                            percent === undefined
                                ? undefined
                                : 100
                        }
                        aria-valuenow={
                            percent
                        }
                    >
                        <div
                            className={
                                percent === undefined
                                    ? (
                                        'ct-progress-value ' +
                                        'ct-progress-indeterminate'
                                    )
                                    : 'ct-progress-value'
                            }
                            style={
                                percent === undefined
                                    ? undefined
                                    : {
                                        width:
                                            `${percent}%`,
                                    }
                            }
                        />
                    </div>
                </div>

                {state.downloadPercent !==
                    undefined &&
                    state.downloadPercent <
                    100 && (
                        <p
                            className="
                ct-progress-secondary
              "
                        >
                            Dil modeli
                            hazırlanıyor… %
                            {
                                state.downloadPercent
                            }
                        </p>
                    )}

                <p
                    className="
            ct-state-hint
          "
                >
                    Çeviri tamamlanana
                    kadar bu pencereyi
                    açık tutun.
                </p>
            </section>
        );
    }

    function renderSuccess() {
        return (
            <section
                className="
          ct-state
          ct-state-success
        "
                role="status"
                aria-live="polite"
            >
                <div
                    className="ct-state-icon"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.8"
                        />

                        <path
                            d="
                m8 12
                2.6 2.6
                L16.5 9
              "
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                <h3 className="ct-state-title">
                    Tarif başarıyla
                    çevrildi
                </h3>

                <p
                    className="
            ct-state-description
          "
                >
                    Çeviri Cookidoo'ya
                    kaydedildi.
                </p>

                <div
                    className="
            ct-result-actions
          "
                >
                    {createdRecipeUrl &&
                    onOpenCreatedRecipe ? (
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                onOpenCreatedRecipe(
                                    createdRecipeUrl,
                                );
                            }}
                        >
                            Oluşturulan
                            tarifi aç
                        </button>
                    ) : (
                        onReload && (
                            <button
                                type="button"
                                className="primary"
                                onClick={
                                    onReload
                                }
                            >
                                Sayfayı yenile
                            </button>
                        )
                    )}

                    {onCancel && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={onCancel}
                        >
                            Kapat
                        </button>
                    )}
                </div>
            </section>
        );
    }

    function renderError(
        state: Extract<
            TranslationUiState,
            {
                status: 'error';
            }
        >,
    ) {
        return (
            <section
                className="
          ct-state
          ct-state-error
        "
                role="alert"
            >
                <div
                    className="ct-state-icon"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="1.8"
                        />

                        <path
                            d="
                M12 7.8v5.4
                M12 16.5v.1
              "
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </div>

                <h3 className="ct-state-title">
                    Tarif çevrilemedi
                </h3>

                <p
                    className="
            ct-state-description
          "
                >
                    {state.message}
                </p>

                {state.createdRecipeId && (
                    <p
                        className="
              ct-state-description
            "
                    >
                        Created Recipe
                        oluşturuldu ancak
                        çeviri veya kaydetme
                        tamamlanmamış
                        olabilir.
                    </p>
                )}

                <div
                    className="
            ct-result-actions
          "
                >
                    {createdRecipeUrl &&
                    onOpenCreatedRecipe ? (
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                onOpenCreatedRecipe(
                                    createdRecipeUrl,
                                );
                            }}
                        >
                            Oluşturulan
                            tarifi aç
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                setTranslation({
                                    status: 'idle',
                                });
                            }}
                        >
                            Tekrar dene
                        </button>
                    )}

                    {onCancel && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={onCancel}
                        >
                            Kapat
                        </button>
                    )}
                </div>
            </section>
        );
    }

    function renderCurrentState() {
        switch (
            translation.status
            ) {
            case 'idle':
                return renderIdle();

            case 'running':
                return renderRunning(
                    translation,
                );

            case 'success':
                return renderSuccess();

            case 'error':
                return renderError(
                    translation,
                );
        }
    }

    return (
        <main className="ct-panel">
            {renderCurrentState()}
        </main>
    );
}

export default TranslatorPanel;
