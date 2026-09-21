import type {CookidooPageInfo} from '../../lib/cookidoo/page.ts';
import {AnnotationMarkerIntegrityError} from '../../lib/translation/translate-prepared-instruction.ts';
import {RecipeLanguageDetectionError} from '../../lib/translation/detect-recipe-language.ts';
import {SameTranslationLanguageError} from '../../lib/translation/translate-created-recipe.ts';
import type {SourceLanguage, SupportedTargetLanguage} from '../../lib/translation/languages.ts';

export interface TranslatorPageContext {
    type: 'public-recipe' | 'created-recipe';
    hostname: string;
    locale: string;
    recipeId: string;
}

export interface PublicRecipeTranslationInput {
    hostname: string;
    locale: string;
    publicRecipeId: string;
    sourceLanguage: SourceLanguage;
    targetLanguage: SupportedTargetLanguage;
}

export function toTranslatorPageContext(
    pageInfo: CookidooPageInfo,
): TranslatorPageContext | undefined {
    if (
        (pageInfo.type !== 'public-recipe' &&
            pageInfo.type !== 'created-recipe') ||
        !pageInfo.hostname ||
        !pageInfo.locale ||
        !pageInfo.recipeId
    ) {
        return undefined;
    }

    return {
        type: pageInfo.type,
        hostname: pageInfo.hostname,
        locale: pageInfo.locale,
        recipeId: pageInfo.recipeId,
    };
}

export function getPublicRecipeTranslationInput(
    page: TranslatorPageContext,
    sourceLanguage: SourceLanguage,
    targetLanguage: SupportedTargetLanguage,
): PublicRecipeTranslationInput | undefined {
    if (
        page.type !== 'public-recipe' ||
        !sourceLanguage
    ) {
        return undefined;
    }

    return {
        hostname: page.hostname,
        locale: page.locale,
        publicRecipeId: page.recipeId,
        sourceLanguage,
        targetLanguage,
    };
}

export function getTranslationErrorMessage(
    error: unknown,
): string {
    if (error instanceof RecipeLanguageDetectionError) {
        return 'Tarif dili güvenilir şekilde algılanamadı. Tarif dilini manuel seçin.';
    }

    if (error instanceof SameTranslationLanguageError) {
        return 'Tarif zaten hedef dilde görünüyor. Farklı bir hedef dil seçin.';
    }

    if (
        error instanceof
        AnnotationMarkerIntegrityError
    ) {
        return (
            'Çeviri sırasında tarifin cihaz ayarları ' +
            'güvenli şekilde korunamadı. Tarif kaydedilmedi.'
        );
    }

    if (
        error instanceof Error &&
        (
            error.message.includes(
                'Chrome Translator API is not available',
            ) ||
            error.message.startsWith(
                'Translation is unavailable for ',
            )
        )
    ) {
        return (
            'Bu dil çifti bu Chrome sürümünde ' +
            'kullanılamıyor.'
        );
    }

    return (
        'Tarif çevrilemedi. Lütfen tekrar deneyin.'
    );
}
