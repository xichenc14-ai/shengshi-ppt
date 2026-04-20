# Error codes

Below are detailed descriptions of error codes returned by the Gamma API.

### Quick reference

* `400` means the request shape or values are invalid.
* `401` usually means the API key is missing or invalid.
* `403` with `"Insufficient credits remaining"` means the workspace is out of credits.
* `404` on generation polling usually means the `generationId` is wrong or unavailable.
* `429` means you should slow down and retry later.

### Example error response

```json
{
  "message": "Invalid API key.",
  "statusCode": 401
}
```

### Error Code Reference

| Status Code | Message                                                   | Description                                                                                                                                             |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400         | Input validation errors                                   | Invalid parameters detected. Check the error details for specific parameter requirements.                                                               |
| 401         | Invalid API key                                           | The provided API key is invalid or not associated with an eligible account.                                                                             |
| 403         | Insufficient credits remaining                            | Your workspace does not have enough credits. Purchase more at [gamma.app/settings/billing](https://gamma.app/settings/billing) or enable auto-recharge. |
| 403         | Forbidden                                                 | Access denied. You do not have permission for this resource, or the requested feature is not available on your plan.                                    |
| 404         | Generation ID not found. generationId: xxxxxx             | The specified generation ID could not be located. Check and correct your generation ID.                                                                 |
| 422         | Failed to generate text. Check your inputs and try again. | Generation produced an empty output. Review your input parameters and ensure your instructions are clear.                                               |
| 429         | Too many requests                                         | Too many requests have been made. Retry after the rate limit period.                                                                                    |
| 500         | An error occurred while generating the gamma.             | An unexpected error occurred while generating the gamma. Contact support with the `x-request-id` header for troubleshooting assistance.                 |
| 502         | Bad gateway                                               | The request could not be processed due to a temporary gateway issue. Try again.                                                                         |

### Troubleshooting Tips

<details>

<summary>400 - Input validation errors</summary>

* Check that all required fields are present (`inputText`, `textMode` for v1.0)
* Verify enum values match exactly (e.g., `presentation` not `Presentation`)
* Ensure `inputText` is between 1 and 400,000 characters
* Check that `numCards` is within your plan’s limits

</details>

### Related

* [Warnings](https://developers.gamma.app/reference/warnings) for non-fatal response warnings
* [Poll for results](https://developers.gamma.app/guides/async-patterns-and-polling) if your error happens during generation status checks
* [Get Help](https://developers.gamma.app/reference/get-help) if you need support escalation

<details>

<summary>401 - Invalid API key</summary>

* Verify your API key starts with `sk-gamma-`
* Check that the key hasn’t been revoked
* Ensure the header is `X-API-KEY` (case-sensitive)

</details>

<details>

<summary>403 - Insufficient credits</summary>

* Check `credits.remaining` on `completed` and `failed` poll responses to monitor your balance
* Enable [auto-recharge](https://gamma.app/settings/billing) to avoid interruptions
* In automated workflows, check the remaining balance after each completed generation before starting another

</details>

<details>

<summary>429 - Rate limit exceeded</summary>

* Wait before retrying (check `Retry-After` header if present)
* Implement exponential backoff in your integration
* Consider upgrading your plan for higher limits

</details>
