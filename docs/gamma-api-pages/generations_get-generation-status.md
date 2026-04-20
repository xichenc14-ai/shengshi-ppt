# GET /generations/{id}

Use this endpoint to poll an existing generation until it reaches `completed` or `failed`. This is where you receive `gammaUrl`, `exportUrl`, and credit usage.

## Get generation status

> Retrieves the current status of a generation job. Poll this endpoint until status is "completed" or "failed". See \[Async Patterns and Polling]\(/overview/async-patterns-and-polling) for full polling implementations.

```json
{"openapi":"3.0.0","info":{"title":"Gamma Public API","version":"1.0"},"tags":[{"name":"public-api","description":"Public API endpoints for external integrations"}],"servers":[{"url":"https://public-api.gamma.app","description":"Production"}],"security":[{"api-key":[]}],"components":{"securitySchemes":{"api-key":{"type":"apiKey","in":"header","name":"X-API-KEY","description":"API key for authentication"}},"schemas":{"GenerationStatusResponse":{"type":"object","properties":{"generationId":{"type":"string","description":"Generation job identifier"},"status":{"$ref":"#/components/schemas/GenerationStatus"},"gammaId":{"type":"string","description":"File identifier for the generated Gamma"},"gammaUrl":{"type":"string","description":"URL to view the generated Gamma"},"error":{"description":"Error details when status is \"failed\"","allOf":[{"$ref":"#/components/schemas/ErrorResponse"}]},"exportUrl":{"type":"string","description":"Download URL for exported file (PDF/PPTX)"},"credits":{"description":"Credit deduction details","allOf":[{"$ref":"#/components/schemas/CreditsResponse"}]}},"required":["generationId","status"]},"GenerationStatus":{"type":"string","description":"Current status of the generation job","enum":["pending","completed","failed"]},"ErrorResponse":{"type":"object","properties":{"message":{"type":"string","description":"Human-readable error description"},"statusCode":{"type":"number","description":"HTTP status code"}},"required":["message","statusCode"]},"CreditsResponse":{"type":"object","properties":{"deducted":{"type":"number","description":"Credits deducted for this generation"},"remaining":{"type":"number","description":"Credits remaining in workspace after deduction"}},"required":["deducted","remaining"]}}},"paths":{"/v1.0/generations/{id}":{"get":{"operationId":"getGenerationStatus","summary":"Get generation status","description":"Retrieves the current status of a generation job. Poll this endpoint until status is \"completed\" or \"failed\". See [Async Patterns and Polling](/overview/async-patterns-and-polling) for full polling implementations.","parameters":[{"name":"id","required":true,"in":"path","description":"The unique generation ID returned from the create endpoint","schema":{"type":"string"}}],"responses":{"200":{"description":"Generation status retrieved successfully","content":{"application/json":{"schema":{"$ref":"#/components/schemas/GenerationStatusResponse"}}}},"401":{"description":"Invalid or missing API key"},"404":{"description":"Generation not found"}},"tags":["public-api"]}}}}
```

{% hint style="info" %}
For usage patterns, see [Poll for results](https://developers.gamma.app/guides/async-patterns-and-polling).
{% endhint %}

## Related

* [Poll for results](https://developers.gamma.app/guides/async-patterns-and-polling) for complete polling implementations
* [POST /generations](https://developers.gamma.app/generations/create-generation) if you need to start a new generation first
