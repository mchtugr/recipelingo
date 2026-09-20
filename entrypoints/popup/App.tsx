import {useEffect, useState} from 'react';
import {browser} from 'wxt/browser';
import {CookidooClient} from '../../lib/cookidoo/client';
import {translateCreatedRecipe} from '../../lib/translation/translate-created-recipe';
import {createAndTranslatePublicRecipe, PublicRecipeTranslationError, type PublicRecipeTranslationProgress} from '../../lib/translation/create-and-translate-public-recipe';
import {getActiveTab} from './active-tab';
import {classifyActiveTab, getPublicRecipeTranslationInput, getTranslationErrorMessage, type PopupPageState} from './state';

const SOURCE_LANGUAGES = [
    ['de', 'Almanca'], ['en', 'İngilizce'], ['es', 'İspanyolca'],
    ['fr', 'Fransızca'], ['it', 'İtalyanca'], ['pl', 'Lehçe'],
    ['pt', 'Portekizce'], ['nl', 'Felemenkçe'], ['cs', 'Çekçe'], ['el', 'Yunanca'],
] as const;

type TranslationUiState =
    | { status: 'idle' }
    | { status: 'running'; progress: PublicRecipeTranslationProgress; downloadPercent?: number }
    | { status: 'success'; createdRecipeId?: string }
    | { status: 'error'; message: string; createdRecipeId?: string };

function progressMessage(progress: PublicRecipeTranslationProgress): string {
    switch (progress.stage) {
        case 'creating':
            return 'Created Recipe oluşturuluyor…';
        case 'loading':
            return 'Tarif yükleniyor…';
        case 'translating-metadata':
            return 'Tarif bilgileri çevriliyor…';
        case "translating-instructions": {
            const count =
                progress.current !== undefined &&
                progress.total !== undefined &&
                progress.current > 0
                    ? ` ${progress.current} / ${progress.total}`
                    : "";

            return `Adımlar çevriliyor…${count}`;
        }
        case 'saving-metadata':
            return 'Tarif bilgileri kaydediliyor…';
        case 'saving-instructions':
            return 'Adımlar kaydediliyor…';
        case 'complete':
            return 'Çeviri tamamlandı.';
    }
}

function App() {
    const [page, setPage] = useState<PopupPageState>({status: 'loading'});
    const [sourceLanguage, setSourceLanguage] = useState('');
    const [translation, setTranslation] = useState<TranslationUiState>({status: 'idle'});

    useEffect(() => {
        let active = true;
        getActiveTab()
            .then((tab) => {
                console.log(tab);
                if (active) setPage(classifyActiveTab(tab));
            })
            .catch(() => {
                if (active) setPage({status: 'error', message: 'Etkin sekme kontrol edilemedi.'});
            });
        return () => {
            active = false;
        };
    }, []);

    async function handleTranslate() {
        if ((page.status !== 'created-recipe' && page.status !== 'public-recipe') || translation.status === 'running' ||
            !sourceLanguage || !page.pageInfo.hostname || !page.pageInfo.locale ||
            !page.pageInfo.recipeId || !Number.isInteger(page.tabId)) return;

        const {hostname, locale, recipeId} = page.pageInfo;
        const isPublic = page.status === 'public-recipe';
        const publicInput = getPublicRecipeTranslationInput(page, sourceLanguage);
        if (isPublic && !publicInput) return;
        setTranslation({status: 'running', progress: {stage: isPublic ? 'creating' : 'loading'}});
        try {
            const client = new CookidooClient({hostname, locale});
            const sharedOptions = {
                sourceLanguage, targetLanguage: 'tr',
                onProgress: (progress) => setTranslation((current) =>
                    current.status === 'running' ? {...current, progress} : current),
                onDownloadProgress: ({percent}) => setTranslation((current) =>
                    current.status === 'running' ? {...current, downloadPercent: percent} : current),
            } satisfies Pick<Parameters<typeof createAndTranslatePublicRecipe>[1], 'sourceLanguage' | 'targetLanguage' | 'onProgress' | 'onDownloadProgress'>;
            if (isPublic) {
                if (!publicInput) throw new Error('Public recipe input is missing');
                const result = await createAndTranslatePublicRecipe(client, {
                    publicRecipeId: publicInput.publicRecipeId,
                    ...sharedOptions,
                    sourceLanguage: publicInput.sourceLanguage,
                    targetLanguage: publicInput.targetLanguage,
                });
                setTranslation({status: 'success', createdRecipeId: result.createdRecipeId});
            } else {
                await translateCreatedRecipe(client, {recipeId, ...sharedOptions});
                setTranslation({status: 'success'});
            }
        } catch (error) {
            if (error instanceof PublicRecipeTranslationError) {
                setTranslation({status: 'error', message: getTranslationErrorMessage(error.cause), createdRecipeId: error.createdRecipeId});
            } else {
                setTranslation({status: 'error', message: isPublic ? 'Tarif Created Recipe olarak oluşturulamadı.' : getTranslationErrorMessage(error)});
            }
        }
    }

    const canTranslate = (page.status === 'created-recipe' || page.status === 'public-recipe') && Boolean(
        sourceLanguage && page.pageInfo.hostname && page.pageInfo.locale &&
        page.pageInfo.recipeId && Number.isInteger(page.tabId) && translation.status !== 'running' &&
        !(page.status === 'public-recipe' && translation.status !== 'idle' && 'createdRecipeId' in translation && translation.createdRecipeId),
    );

    const createdRecipeUrl =
        (page.status === 'created-recipe' || page.status === 'public-recipe') &&
        translation.status !== 'idle' && translation.status !== 'running' &&
        translation.createdRecipeId && page.pageInfo.hostname && page.pageInfo.locale
            ? `https://${page.pageInfo.hostname}/created-recipes/${encodeURIComponent(page.pageInfo.locale)}/${encodeURIComponent(translation.createdRecipeId)}`
            : undefined;

    return <main>
        <h1>Cookidoo Translator</h1>
        {page.status === 'loading' && <p role="status">Tarif kontrol ediliyor…</p>}
        {(page.status === 'created-recipe' || page.status === 'public-recipe') && <>
            <p>{page.status === 'created-recipe' ? 'Bu Created Recipe çevrilebilir.' : 'Bu Cookidoo tarifi Created Recipe olarak oluşturulup çevrilebilir.'}</p>
            <div className="fields">
                <label htmlFor="source-language">Tarif dili</label>
                <select id="source-language" value={sourceLanguage} disabled={translation.status === 'running' || (page.status === 'public-recipe' && translation.status !== 'idle' && 'createdRecipeId' in translation && Boolean(translation.createdRecipeId))}
                        onChange={(event) => {
                            setSourceLanguage(event.target.value);
                            setTranslation({status: 'idle'});
                        }}>
                    <option value="">Dil seçin</option>
                    {SOURCE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label htmlFor="target-language">Hedef dil</label>
                <select id="target-language" value="tr" disabled>
                    <option value="tr">Türkçe</option>
                </select>
            </div>
            <button type="button" disabled={!canTranslate} onClick={handleTranslate}>{page.status === 'public-recipe' ? 'Oluştur ve çevir' : 'Tarifi çevir'}</button>
      {translation.status === 'running' && <div role="status" aria-live="polite" className="notice">
          <p>{progressMessage(translation.progress)}</p>
          {translation.downloadPercent !== undefined &&
              translation.downloadPercent < 100 && (
                  <p>
                      Dil modeli hazırlanıyor… %
                      {translation.downloadPercent}
                  </p>
              )}
      </div>}
            {translation.status === 'success' && <div role="status" aria-live="polite" className="notice success">
                <p>Tarif başarıyla çevrildi.</p>
                {createdRecipeUrl
                    ? <button type="button" className="secondary" onClick={() => void browser.tabs.update(page.tabId, {url: createdRecipeUrl})}>Oluşturulan tarifi aç</button>
                    : <button type="button" className="secondary" onClick={() => void browser.tabs.reload(page.tabId)}>Sayfayı yenile</button>}
            </div>}
            {translation.status === 'error' && <div role="alert" className="notice error"><p>{translation.message}</p>{createdRecipeUrl && <><p>Created Recipe oluşturuldu; çeviri veya kaydetme tamamlanmamış olabilir.</p><button type="button" className="secondary" onClick={() => void browser.tabs.update(page.tabId, {url: createdRecipeUrl})}>Oluşturulan tarifi aç</button></>}</div>}
        </>}
        {page.status === 'cookidoo' && <p>Bir Cookidoo tarif sayfası açın.</p>}
        {page.status === 'other' && <p>Cookidoo Translator'ı kullanmak için Cookidoo'da bir tarif açın.</p>}
        {page.status === 'error' && <p role="alert" className="error">{page.message}</p>}
    </main>;
}

export default App;
