import {
    useEffect,
    useState,
} from 'react';

import {CookidooClient} from '../lib/cookidoo/client';

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

const SOURCE_LANGUAGES = [
    ['de', 'Almanca'],
    ['en', 'İngilizce'],
    ['es', 'İspanyolca'],
    ['fr', 'Fransızca'],
    ['it', 'İtalyanca'],
    ['pl', 'Lehçe'],
    ['pt', 'Portekizce'],
    ['nl', 'Felemenkçe'],
    ['cs', 'Çekçe'],
    ['el', 'Yunanca'],
] as const;

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
            return 'Adımlar kaydediliyor…';

        case 'complete':
            return 'Çeviri tamamlandı.';
    }
}

function createCreatedRecipeUrl(
    page: TranslatorPageContext,
    recipeId: string,
): string {
    return (
        `https://${page.hostname}` +
        `/created-recipes/` +
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
    ] = useState('');

    const [
        translation,
        setTranslation,
    ] = useState<TranslationUiState>({
        status: 'idle',
    });

    const isRunning =
        translation.status === 'running';

    const hasCreatedRecipe =
        (
            translation.status ===
            'success' ||
            translation.status === 'error'
        ) &&
        Boolean(
            translation.createdRecipeId,
        );

    useEffect(() => {
        onRunningChange?.(isRunning);
    }, [
        isRunning,
        onRunningChange,
    ]);

    async function handleTranslate() {
        if (
            isRunning ||
            !sourceLanguage
        ) {
            return;
        }

        if (
            typeof Translator ===
            'undefined'
        ) {
            setTranslation({
                status: 'error',
                message:
                    'Bu ortamda Chrome Translator API kullanılamıyor.',
            });

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
            targetLanguage: 'tr',

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
                    ? 'Tarif Created Recipe olarak oluşturulamadı.'
                    : getTranslationErrorMessage(
                        error,
                    ),
            });
        }
    }

    function handleSourceChange(
        value: string,
    ) {
        setSourceLanguage(value);

        setTranslation({
            status: 'idle',
        });
    }

    const canTranslate =
        Boolean(
            sourceLanguage &&
            !isRunning &&
            !(
                page.type ===
                'public-recipe' &&
                hasCreatedRecipe
            ),
        );

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

    return (
        <main className="ct-panel">
            <p>
                {page.type ===
                'created-recipe'
                    ? 'Bu Created Recipe çevrilebilir.'
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
                        value={
                            sourceLanguage
                        }
                        disabled={
                            isRunning ||
                            (
                                page.type ===
                                'public-recipe' &&
                                hasCreatedRecipe
                            )
                        }
                        onChange={(
                            event,
                        ) => {
                            handleSourceChange(
                                event.target.value,
                            );
                        }}
                    >
                        <option value="">
                            Dil seçin
                        </option>

                        {SOURCE_LANGUAGES.map(
                            ([value, label]) => (
                                <option
                                    key={value}
                                    value={value}
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
                        value="tr"
                        disabled
                    >
                        <option value="tr">
                            Türkçe
                        </option>
                    </select>
                </div>
            </div>

            <div className="actions">
                {onCancel && (
                    <button
                        type="button"
                        className="secondary"
                        disabled={isRunning}
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

            {translation.status ===
                'running' && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="notice"
                    >
                        <p>
                            {progressMessage(
                                translation.progress,
                            )}
                        </p>

                        {translation.downloadPercent !==
                            undefined &&
                            translation.downloadPercent <
                            100 && (
                                <p>
                                    Dil modeli
                                    hazırlanıyor… %
                                    {
                                        translation.downloadPercent
                                    }
                                </p>
                            )}
                    </div>
                )}

            {translation.status ===
                'success' && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="notice success"
                    >
                        <p>
                            Tarif başarıyla
                            çevrildi.
                        </p>

                        {createdRecipeUrl &&
                        onOpenCreatedRecipe ? (
                            <button
                                type="button"
                                className="secondary"
                                onClick={() =>
                                    onOpenCreatedRecipe(
                                        createdRecipeUrl,
                                    )
                                }
                            >
                                Oluşturulan tarifi
                                aç
                            </button>
                        ) : (
                            onReload && (
                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={
                                        onReload
                                    }
                                >
                                    Sayfayı yenile
                                </button>
                            )
                        )}
                    </div>
                )}

            {translation.status ===
                'error' && (
                    <div
                        role="alert"
                        className="notice error"
                    >
                        <p>
                            {translation.message}
                        </p>

                        {createdRecipeUrl && (
                            <>
                                <p>
                                    Created Recipe
                                    oluşturuldu; çeviri
                                    veya kaydetme
                                    tamamlanmamış
                                    olabilir.
                                </p>

                                {onOpenCreatedRecipe && (
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() =>
                                            onOpenCreatedRecipe(
                                                createdRecipeUrl,
                                            )
                                        }
                                    >
                                        Oluşturulan tarifi
                                        aç
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
        </main>
    );
}

export default TranslatorPanel;