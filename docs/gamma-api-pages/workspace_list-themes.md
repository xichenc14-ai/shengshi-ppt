# GET /themes

List the themes available in the authenticated workspace. Use the returned `id` values as `themeId` in generation requests.

## List themes

> Lists all themes available to the workspace, including standard themes and custom workspace themes. See \[Themes and Folders APIs]\(/overview/list-themes-and-list-folders-apis-explained).

```json
{"openapi":"3.0.0","info":{"title":"Gamma Public API","version":"1.0"},"tags":[{"name":"public-api","description":"Public API endpoints for external integrations"}],"servers":[{"url":"https://public-api.gamma.app","description":"Production"}],"security":[{"api-key":[]}],"components":{"securitySchemes":{"api-key":{"type":"apiKey","in":"header","name":"X-API-KEY","description":"API key for authentication"}},"schemas":{"ListThemesResponse":{"type":"object","properties":{"data":{"description":"List of themes","type":"array","items":{"$ref":"#/components/schemas/ThemeItem"}},"hasMore":{"type":"boolean","description":"Whether more results are available"},"nextCursor":{"type":"string","nullable":true,"description":"Cursor for next page, null if no more results"}},"required":["data","hasMore"]},"ThemeItem":{"type":"object","properties":{"id":{"type":"string","description":"Unique theme identifier"},"name":{"type":"string","description":"Theme display name"},"colorKeywords":{"description":"Color-related keywords","type":"array","items":{"type":"string"}},"toneKeywords":{"description":"Tone/style keywords","type":"array","items":{"type":"string"}},"type":{"$ref":"#/components/schemas/ThemeType"}},"required":["id","name","type"]},"ThemeType":{"type":"string","description":"Source of the theme","enum":["standard","custom"]}}},"paths":{"/v1.0/themes":{"get":{"operationId":"listThemes","summary":"List themes","description":"Lists all themes available to the workspace, including standard themes and custom workspace themes. See [Themes and Folders APIs](/overview/list-themes-and-list-folders-apis-explained).","parameters":[{"name":"query","required":false,"in":"query","description":"Search query to filter themes by name","schema":{"type":"string"}},{"name":"limit","required":false,"in":"query","description":"Maximum results to return (1-100)","schema":{"minimum":1,"maximum":50,"type":"number"}},{"name":"after","required":false,"in":"query","description":"Pagination cursor from previous response","schema":{"type":"string"}}],"responses":{"200":{"description":"Themes retrieved successfully","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ListThemesResponse"}}}},"401":{"description":"Invalid or missing API key"}},"tags":["public-api"]}}}}
```

{% hint style="info" %}
For guidance on when to fetch theme IDs and how to use them in requests, see [Use themes and folders](https://developers.gamma.app/guides/list-themes-and-list-folders-apis-explained).
{% endhint %}

## Related

* [Use themes and folders](https://developers.gamma.app/guides/list-themes-and-list-folders-apis-explained) for workflow guidance
* [POST /generations](https://developers.gamma.app/generations/create-generation) if you want to apply a returned `themeId`
