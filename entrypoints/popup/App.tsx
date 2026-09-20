import {useEffect, useState} from 'react';
import {browser} from 'wxt/browser';
import {CookidooClient} from '../../lib/cookidoo/client';
import {translateCreatedRecipe, type RecipeTranslationProgress} from '../../lib/translation/translate-created-recipe';
import {getActiveTab} from './active-tab';
import {classifyActiveTab, getTranslationErrorMessage, type PopupPageState} from './state';

const SOURCE_LANGUAGES = [
    ['de', 'Almanca'], ['en', 'İngilizce'], ['es', 'İspanyolca'],
    ['fr', 'Fransızca'], ['it', 'İtalyanca'], ['pl', 'Lehçe'],
    ['pt', 'Portekizce'], ['nl', 'Felemenkçe'], ['cs', 'Çekçe'], ['el', 'Yunanca'],
] as const;

type TranslationUiState =
    | { status: 'idle' }
    | { status: 'running'; progress: RecipeTranslationProgress; downloadPercent?: number }
    | { status: 'success' }
    | { status: 'error'; message: string };

function progressMessage(progress: RecipeTranslationProgress): string {
    switch (progress.stage) {
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
        if (page.status !== 'created-recipe' || translation.status === 'running' ||
            !sourceLanguage || !page.pageInfo.hostname || !page.pageInfo.locale ||
            !page.pageInfo.recipeId || !Number.isInteger(page.tabId)) return;

        const {hostname, locale, recipeId} = page.pageInfo;
        setTranslation({status: 'running', progress: {stage: 'loading'}});
        try {
            const client = new CookidooClient({hostname, locale});
            await translateCreatedRecipe(client, {
                recipeId, sourceLanguage, targetLanguage: 'tr',
                onProgress: (progress) => setTranslation((current) =>
                    current.status === 'running' ? {...current, progress} : current),
                onDownloadProgress: ({percent}) => setTranslation((current) =>
                    current.status === 'running' ? {...current, downloadPercent: percent} : current),
            });
            setTranslation({status: 'success'});
        } catch (error) {
            setTranslation({status: 'error', message: getTranslationErrorMessage(error)});
        }
    }

    const canTranslate = page.status === 'created-recipe' && Boolean(
        sourceLanguage && page.pageInfo.hostname && page.pageInfo.locale &&
        page.pageInfo.recipeId && Number.isInteger(page.tabId) && translation.status !== 'running',
    );

    return <main>
        <h1>Cookidoo Translator</h1>
        {page.status === 'loading' && <p role="status">Tarif kontrol ediliyor…</p>}
        {page.status === 'created-recipe' && <>
            <p>Bu Created Recipe çevrilebilir.</p>
            <div className="fields">
                <label htmlFor="source-language">Tarif dili</label>
                <select id="source-language" value={sourceLanguage} disabled={translation.status === 'running'}
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
            <button type="button" disabled={!canTranslate} onClick={handleTranslate}>Tarifi çevir</button>
      {translation.status === 'running' && <div role="status" aria-live="polite" className="notice">
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
                <button type="button" className="secondary" onClick={() => void browser.tabs.reload(page.tabId)}>
                    Sayfayı yenile
                </button>
            </div>}
            {translation.status === 'error' && <p role="alert" className="notice error">{translation.message}</p>}
        </>}
        {page.status === 'public-recipe' && <><p>Bu bir Cookidoo tarifi.</p><p>Çevirebilmek için önce Created Recipe
            olarak oluşturulması gerekiyor.</p></>}
        {page.status === 'cookidoo' && <p>Bir Cookidoo tarif sayfası açın.</p>}
        {page.status === 'other' && <p>Cookidoo Translator'ı kullanmak için Cookidoo'da bir tarif açın.</p>}
        {page.status === 'error' && <p role="alert" className="error">{page.message}</p>}
    </main>;
}

export default App;
