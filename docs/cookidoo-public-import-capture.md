# Public recipe import capture

Captured from Cookidoo's own UI on `cookidoo.com.tr` for public recipe `r912684` on 20 September 2026.

Authentication headers, cookies, session values, and other sensitive credentials are intentionally omitted.

## Import request

### Request

* URL:

  `https://cookidoo.com.tr/created-recipes/tr-TR/add-to-cookidoo`

* Method:

  `POST`

* `Accept`:

  `application/json`

* `Content-Type`:

  `application/json`

### Request body

```json
{
  "recipeUrl": "https://cookidoo.com.tr/recipes/recipe/tr-TR/r912684",
  "partnerId": "cookidoo"
}
```

The public recipe ID and locale are represented inside `recipeUrl`.

The import endpoint itself also contains the locale:

```text
/created-recipes/{locale}/add-to-cookidoo
```

For this capture:

```text
locale: tr-TR
public recipe ID: r912684
```

## Successful response

* Status:

  `200 OK`

* `Content-Type`:

  `application/json; charset=utf-8`

The response body is a full Created Recipe object.

Observed top-level fields include:

```text
recipeId
authorId
modifiedAt
createdAt
status
workStatus
recipeContent
```

Captured Created Recipe ID:

```text
01M30EA44836FD5FJHSY6T3VG5
```

The response contains the new ID at:

```text
response.recipeId
```

The captured `recipeContent.isBasedOn` value was:

```text
https://cookidoo.com.tr/recipes/recipe/tr-TR/r912684
```

This confirms the relationship between the imported Created Recipe and the original public Cookidoo recipe.

## Created Recipe URLs

The Created Recipe API resource URL is:

```text
https://cookidoo.com.tr/crea
```
