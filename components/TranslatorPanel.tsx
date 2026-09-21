import {
    useEffect,
    useState,
} from 'react';
import { i18n } from '#i18n';

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
    getTranslationErrorMessageKey,
    type TranslatorErrorMessageKey,
    type TranslatorPageContext,
} from './translator/state';
import {
    resolveTargetLanguage,
    SUPPORTED_TARGET_LANGUAGES,
    TRANSLATION_LANGUAGES,
    type SourceLanguage,
    type SupportedTargetLanguage,
    type TranslationLanguage,
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
    messageKey: TranslatorErrorMessageKey;
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

export function appendInstructionProgress(
    message: string,
    current?: number,
    total?: number,
): string {
    return current !== undefined &&
        total !== undefined &&
        current > 0
        ? `${message} ${current} / ${total}`
        : message;
}

function progressMessage(
    progress:
    PublicRecipeTranslationProgress,
): string {
    switch (progress.stage) {
        case 'creating':
            return i18n.t('translator.progress.creating');

        case 'loading':
            return i18n.t('translator.progress.loading');

        case 'detecting-language':
            return i18n.t('translator.progress.detectingLanguage');

        case 'translating-metadata':
            return i18n.t('translator.progress.translatingMetadata');

        case 'translating-instructions': {
            return appendInstructionProgress(
                i18n.t('translator.progress.translatingInstructions'),
                progress.current,
                progress.total,
            );
        }

        case 'saving-metadata':
            return i18n.t('translator.progress.savingMetadata');

        case 'saving-instructions':
            return i18n.t('translator.progress.savingInstructions');

        case 'complete':
            return i18n.t('translator.progress.complete');
    }
}

const LANGUAGE_MESSAGE_KEYS = {
    tr: 'languages.tr',
    de: 'languages.de',
    en: 'languages.en',
    es: 'languages.es',
    fr: 'languages.fr',
    it: 'languages.it',
    pl: 'languages.pl',
    pt: 'languages.pt',
    nl: 'languages.nl',
    cs: 'languages.cs',
    el: 'languages.el',
} as const satisfies Record<TranslationLanguage, `languages.${TranslationLanguage}`>;

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

                    messageKey:
                        getTranslationErrorMessageKey(
                            error.cause,
                        ),

                    createdRecipeId:
                    error.createdRecipeId,
                });

                return;
            }

            setTranslation({
                status: 'error',

                messageKey: isPublic
                    ? 'translator.error.importFailed'
                    : getTranslationErrorMessageKey(
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
                            i18n.t('translator.intro.createdRecipe')
                        )
                        : (
                            i18n.t('translator.intro.publicRecipe')
                        )}
                </p>

                <div className="fields">
                    <div className="field">
                        <label
                            htmlFor="source-language"
                        >
                            {i18n.t('translator.fields.sourceLanguage')}
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
                                {i18n.t('translator.fields.autoDetect')}
                            </option>

                            {TRANSLATION_LANGUAGES.map(
                                (code) => (
                                    <option
                                        key={code}
                                        value={code}
                                    >
                                        {i18n.t(LANGUAGE_MESSAGE_KEYS[code])}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>

                    <div className="field">
                        <label
                            htmlFor="target-language"
                        >
                            {i18n.t('translator.fields.targetLanguage')}
                        </label>

                        <select
                            id="target-language"
                            value={targetLanguage ?? ''}
                            disabled={targetLanguage === null || isRunning}
                            onChange={(event) => {
                                handleTargetChange(event.target.value);
                            }}
                        >
                            {targetLanguage === null && (
                                <option value="">{i18n.t('translator.fields.loading')}</option>
                            )}
                            {SUPPORTED_TARGET_LANGUAGES.map((code) => (
                                <option key={code} value={code}>
                                    {i18n.t(LANGUAGE_MESSAGE_KEYS[code])}
                                </option>
                            ))}
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
                            {i18n.t('translator.actions.cancel')}
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
                            ? i18n.t('translator.actions.createAndTranslate')
                            : i18n.t('translator.actions.translate')}
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
                    {i18n.t('translator.progress.title')}
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
                                ? i18n.t('translator.progress.label')
                                : i18n.t('translator.progress.labelPercent', {
                                    percent: String(percent),
                                })
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
                            {i18n.t('translator.progress.preparingModel')}
                            {' %'}{state.downloadPercent}
                        </p>
                    )}

                <p
                    className="
            ct-state-hint
          "
                >
                    {i18n.t('translator.progress.keepOpen')}
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
                    {i18n.t('translator.success.title')}
                </h3>

                <p
                    className="
            ct-state-description
          "
                >
                    {i18n.t('translator.success.description')}
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
                            {i18n.t('translator.actions.openCreatedRecipe')}
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
                                {i18n.t('translator.actions.reload')}
                            </button>
                        )
                    )}

                    {onCancel && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={onCancel}
                        >
                            {i18n.t('translator.actions.close')}
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
                    {i18n.t('translator.error.title')}
                </h3>

                <p
                    className="
            ct-state-description
          "
                >
                    {i18n.t(state.messageKey)}
                </p>

                {state.createdRecipeId && (
                    <p
                        className="
              ct-state-description
            "
                    >
                        {i18n.t('translator.error.createdRecipePartial')}
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
                            {i18n.t('translator.actions.openCreatedRecipe')}
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
                            {i18n.t('translator.actions.retry')}
                        </button>
                    )}

                    {onCancel && (
                        <button
                            type="button"
                            className="secondary"
                            onClick={onCancel}
                        >
                            {i18n.t('translator.actions.close')}
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
