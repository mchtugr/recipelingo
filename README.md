# RecipeLingo — Recipe Translator

RecipeLingo is a Chrome extension built with WXT, React, and TypeScript that translates Cookidoo recipes while preserving Guided Cooking information.

## Features

- Translate Cookidoo recipes directly from the recipe page.
- Translate public recipes by importing a copy into Created Recipes.
- Translate existing Created Recipes in place.
- Preserve supported Guided Cooking annotations during translation.
- Automatically detect the recipe language or let you select it manually.
- Uses Chrome's built-in Translator API for translation.
- Translation runs locally in Chrome; RecipeLingo does not send recipe content to its own servers.
- Supports Cookidoo's SPA navigation and multiple regional Cookidoo domains.

## Supported Target Languages

RecipeLingo currently supports translation into:

- English
- German
- French
- Spanish
- Italian
- Turkish

Additional target languages may be added after their Guided Cooking annotation formatting has been verified.

## How It Works

On a supported Cookidoo recipe page, RecipeLingo adds a translation action alongside the existing recipe controls.

For public recipes:

1. The recipe is imported into your Created Recipes.
2. RecipeLingo translates the imported copy.
3. The original public recipe remains unchanged.

For Created Recipes:

1. RecipeLingo loads the existing recipe.
2. Recipe content is translated into the selected target language.
3. Supported Guided Cooking information is preserved and validated.
4. The translated content is saved back to the Created Recipe.

RecipeLingo validates annotation integrity before saving translated instructions. If Guided Cooking information cannot be preserved safely, the translation is stopped rather than saving potentially corrupted recipe data.

## Known Issues

### Turkish source recipes with Guided Cooking annotations

Translations **from Turkish** may fail for some recipe instructions where Guided Cooking annotations are directly combined with Turkish grammatical suffixes, for example:

```text
<0>'te
<1>’te
```

Chrome's Translator API may restructure these expressions during translation in a way that removes or reorders an annotation marker.

RecipeLingo detects these cases through annotation integrity validation and stops the translation instead of saving potentially corrupted Guided Cooking data.

This issue has currently been observed when translating **from Turkish**. Translations **into Turkish**, as well as translations from the other primarily tested source languages, have not shown the same issue in current testing.

## Privacy

RecipeLingo does not operate its own backend service.

Recipe content is not sent to RecipeLingo servers or to an external translation service operated by RecipeLingo. Translation is performed using Chrome's built-in Translator API.

RecipeLingo accesses Cookidoo only as required to read, import, translate, and update recipes using your existing Cookidoo session.

RecipeLingo does not include advertising, analytics, or third-party tracking.

## Disclaimer

RecipeLingo is an independent, unofficial project and is not affiliated with, endorsed by, sponsored by, or associated with Vorwerk.

Cookidoo and Thermomix are trademarks of their respective owners. All trademarks and product names mentioned in this project remain the property of their respective owners.

RecipeLingo is provided as an independent tool for translating recipe content and does not replace or modify the official Cookidoo or Thermomix services.