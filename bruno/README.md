# Cookidoo Bruno Collection

Bruno collection for manually testing and inspecting the Cookidoo APIs used by the project.

The collection focuses on public recipes, created recipes, authentication/session validation, and recipe update flows.

## Structure

```text
bruno/
├── README.md
├── opencollection.yml
├── environments/
│   └── turkey.yml
├── auth/
│   └── check-session.yml
├── recipes/
│   └── get-recipe.yml
└── created-recipes/
    ├── list-created-recipes.yml
    ├── get-created-recipe.yml
    ├── create-created-recipe.yml
    ├── import-public-recipe.yml
    ├── update-created-recipe.yml
    ├── update-metadata.yml
    ├── update-ingredients.yml
    ├── update-instructions.yml
    ├── delete-created-recipe.yml
    ├── delete-selected-created-recipes.yml
    └── delete-all-created-recipes.yml
```

## Requirements

* Bruno
* A valid Cookidoo account
* An authenticated Cookidoo browser session

## Environment

Select the `turkey` environment in Bruno.

The environment defines values such as:

```text
baseUrl = https://cookidoo.com.tr
locale = tr-TR
```

Recipe-specific values may be supplied at request level or populated dynamically during a workflow.

## Authentication

Cookidoo requests use the authenticated browser session.

Log in to Cookidoo normally in the browser and copy the required authentication cookies into Bruno's Cookie Jar for:

```text
cookidoo.com.tr
```

The authentication cookies currently used by the collection are:

```text
_oauth2_proxy
v-authenticated
```

When adding them to Bruno, use:

```text
Domain: cookidoo.com.tr
Path: /
```

Do not use `.cookidoo.com.tr` as the Bruno cookie domain if Bruno fails to attach the cookies to requests.

Cookie values are session credentials and must not be committed to Git.

### Check Session

Run:

```text
Auth / Check Session
```

before other requests to verify that the current Cookie Jar session is still authenticated.

## Public Recipes

### Get Recipe

Fetches a public Cookidoo recipe.

```text
Recipes / Get Recipe
```

The public recipe ID can be changed from the request variables.

## Created Recipes

### List Created Recipes

Returns the user's created recipes.

The response contains recipes under:

```json
{
  "items": [
    {
      "recipeId": "..."
    }
  ]
}
```

### Get Created Recipe

Fetches a single created recipe using:

```text
createdRecipeId
```

### Create Created Recipe

Creates a new custom recipe.

Useful for testing recipe creation independently of the public-recipe import flow.

### Import Public Recipe

Imports an existing public Cookidoo recipe into Created Recipes.

This is useful for testing the translator against a real Cookidoo recipe while keeping the original public recipe unchanged.

A successful import can be used to populate `createdRecipeId` for subsequent requests.

## Updating Created Recipes

### Update Created Recipe

Updates the complete created-recipe payload.

Use this when testing the complete update flow.

### Update Metadata

Updates only recipe metadata.

This request exists separately for fast manual testing and debugging without editing ingredients or instructions.

### Update Ingredients

Updates only the ingredients.

This is intentionally kept as a separate request for quick access while developing or debugging ingredient translation.

### Update Instructions

Updates only the instructions.

This is intentionally kept as a separate request for quick access while developing or debugging instruction translation.

The dedicated metadata, ingredients, and instructions requests overlap with `Update Created Recipe` by design. They make it easier to test individual parts of the translation/update pipeline without repeatedly editing a full recipe payload.

## Deleting Created Recipes

### Delete Created Recipe

Deletes one recipe using:

```text
createdRecipeId
```

### Delete Selected Created Recipes

Deletes multiple explicitly selected created recipes.

The selected recipe IDs are supplied as a request variable rather than being hardcoded into the script.

The flow:

```text
GET created recipes
        ↓
read response.items
        ↓
match selected recipe IDs
        ↓
DELETE each matching recipe sequentially
```

Requests are sent sequentially rather than in parallel.

### Delete All Created Recipes

Deletes every recipe returned by the Created Recipes listing endpoint.

The flow:

```text
GET created recipes
        ↓
extract recipeId from response.items
        ↓
DELETE recipe 1
        ↓
DELETE recipe 2
        ↓
...
```

DELETE requests are sent sequentially and actual HTTP response statuses are used to determine success or failure.

> **Warning**
>
> `Delete All Created Recipes` is destructive. Running it can permanently remove all custom recipes returned by the listing endpoint.

## Suggested Workflow

For testing a public recipe through the complete created-recipe flow:

```text
1. Check Session
2. Get Recipe
3. Import Public Recipe
4. Get Created Recipe
5. Update Metadata
6. Update Ingredients
7. Update Instructions
8. Get Created Recipe
9. Delete Created Recipe
```

For testing a complete payload update:

```text
1. Check Session
2. Import Public Recipe
3. Get Created Recipe
4. Update Created Recipe
5. Get Created Recipe
6. Delete Created Recipe
```

## Bulk Delete Requests

Bulk deletion scripts use Bruno's scripting API to send DELETE requests programmatically.

Authentication cookies are read from Bruno's Cookie Jar and attached to these scripted requests.

Bulk operations report the final result in the Bruno console, for example:

```text
Found 3 created recipe(s).

✓ recipe-id-1 -> HTTP 204
✓ recipe-id-2 -> HTTP 204
✗ recipe-id-3 -> HTTP 404

Finished. Deleted: 2, Failed: 1
```

Script-generated requests can also be inspected in Bruno's Timeline.

## Security

Never commit:

* `_oauth2_proxy`
* `v-authenticated`
* other Cookidoo session cookies
* passwords or login credentials

Treat authentication cookies like credentials.

The collection should contain only request definitions, environment configuration, and non-sensitive example values.
