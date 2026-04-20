# GET /folders

List the folders the authenticated user can access. Use the returned `id` values in `folderIds` when you want generated output stored in a specific folder.

## List folders

> Lists all folders the authenticated user is a member of within the workspace. See \[Themes and Folders APIs]\(/overview/list-themes-and-list-folders-apis-explained).

```json
{"openapi":"3.0.0","info":{"title":"Gamma Public API","version":"1.0"},"tags":[{"name":"public-api","description":"Public API endpoints for external integrations"}],"servers":[{"url":"https://public-api.gamma.app","description":"Production"}],"security":[{"api-key":[]}],"components":{"securitySchemes":{"api-key":{"type":"apiKey","in":"header","name":"X-API-KEY","description":"API key for authentication"}},"schemas":{"ListFoldersResponse":{"type":"object","properties":{"data":{"description":"List of folders","type":"array","items":{"$ref":"#/components/schemas/FolderItem"}},"hasMore":{"type":"boolean","description":"Whether more results are available"},"nextCursor":{"type":"string","nullable":true,"description":"Cursor for next page, null if no more results"}},"required":["data","hasMore"]},"FolderItem":{"type":"object","properties":{"id":{"type":"string","description":"Unique folder identifier"},"name":{"type":"string","description":"Folder display name"}},"required":["id","name"]}}},"paths":{"/v1.0/folders":{"get":{"operationId":"listFolders","summary":"List folders","description":"Lists all folders the authenticated user is a member of within the workspace. See [Themes and Folders APIs](/overview/list-themes-and-list-folders-apis-explained).","parameters":[{"name":"query","required":false,"in":"query","description":"Search query to filter folders by name","schema":{"type":"string"}},{"name":"limit","required":false,"in":"query","description":"Maximum results to return","schema":{"minimum":1,"maximum":50,"type":"number"}},{"name":"after","required":false,"in":"query","description":"Pagination cursor from previous response","schema":{"type":"string"}}],"responses":{"200":{"description":"Folders retrieved successfully","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ListFoldersResponse"}}}},"401":{"description":"Invalid or missing API key"}},"tags":["public-api"]}}}}
```

{% hint style="info" %}
For guidance on when to fetch folder IDs and how to use them in requests, see [Use themes and folders](https://developers.gamma.app/guides/list-themes-and-list-folders-apis-explained).
{% endhint %}

## Related

* [Use themes and folders](https://developers.gamma.app/guides/list-themes-and-list-folders-apis-explained) for workflow guidance
* [POST /generations](https://developers.gamma.app/generations/create-generation) if you want to place output into one or more folders
