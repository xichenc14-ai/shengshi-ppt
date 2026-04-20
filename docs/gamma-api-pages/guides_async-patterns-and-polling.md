# Poll for results

Gamma generation is asynchronous. You start a generation, receive a `generationId` immediately, then poll the status endpoint until the result is ready.

### Quick reference

* `POST /v1.0/generations` returns `generationId` only.
* Poll `GET /v1.0/generations/{generationId}` every 5 seconds until `status` is `completed` or `failed`.
* `gammaUrl` and `exportUrl` are only available from the completed status response.
* Export URLs are signed and expire after approximately one week. Download exported files promptly.

### The basic flow

```
POST /generations      →  Returns { generationId: "abc123" }
Wait ~5 seconds
GET /generations/abc123  →  Returns { status: "pending" }
Wait ~5 seconds  
GET /generations/abc123  →  Returns { status: "completed", gammaUrl: "...", exportUrl: "..." }
```

### What you get back

When status is `completed`, the response includes:

| Field       | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| `gammaUrl`  | Direct link to view/share the presentation in Gamma              |
| `exportUrl` | Download URL for the exported file (if `exportAs` was specified) |

### Generation states

| Status      | Meaning              | What to Do                                    |
| ----------- | -------------------- | --------------------------------------------- |
| `pending`   | Still generating     | Keep polling every 5 seconds                  |
| `completed` | Done!                | Stop polling — use `gammaUrl` and export URLs |
| `failed`    | Something went wrong | Stop polling, check the `error` object        |

### Code examples

{% tabs %}
{% tab title="Python" %}

```python
import requests
import time

API_KEY = "sk-gamma-xxxxx"
BASE_URL = "https://public-api.gamma.app"

def generate_and_wait(payload, max_attempts=60, poll_interval=5):
    """Generate a gamma and wait for completion."""
    
    # Step 1: Start generation
    response = requests.post(
        f"{BASE_URL}/v1.0/generations",
        headers={
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json"
        },
        json=payload
    )
    response.raise_for_status()
    generation_id = response.json()["generationId"]
    print(f"Generation started: {generation_id}")
    
    # Step 2: Poll for completion
    for attempt in range(max_attempts):
        time.sleep(poll_interval)
        
        status_response = requests.get(
            f"{BASE_URL}/v1.0/generations/{generation_id}",
            headers={"X-API-KEY": API_KEY}
        )
        status_response.raise_for_status()
        result = status_response.json()
        
        status = result.get("status")
        print(f"Attempt {attempt + 1}: {status}")
        
        if status == "completed":
            return result  # Success! Contains gammaUrl
        elif status == "failed":
            raise Exception(f"Generation failed: {result.get('error')}")
        # status == "pending" - keep polling
    
    raise TimeoutError("Generation timed out")

# Usage
result = generate_and_wait({
    "inputText": "Create a presentation about renewable energy",
    "textMode": "generate",
    "format": "presentation",
    "numCards": 8
})
print(f"Done! View at: {result['gammaUrl']}")
```

{% endtab %}

{% tab title="JavaScript" %}

```javascript
const API_KEY = "sk-gamma-xxxxx";
const BASE_URL = "https://public-api.gamma.app";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateAndWait(payload, maxAttempts = 60, pollInterval = 5000) {
  // Step 1: Start generation
  const startResponse = await fetch(`${BASE_URL}/v1.0/generations`, {
    method: "POST",
    headers: {
      "X-API-KEY": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!startResponse.ok) {
    throw new Error(`Failed to start: ${await startResponse.text()}`);
  }
  
  const { generationId } = await startResponse.json();
  console.log(`Generation started: ${generationId}`);
  
  // Step 2: Poll for completion
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);
    
    const statusResponse = await fetch(
      `${BASE_URL}/v1.0/generations/${generationId}`,
      { headers: { "X-API-KEY": API_KEY } }
    );
    
    const result = await statusResponse.json();
    console.log(`Attempt ${attempt + 1}: ${result.status}`);
    
    if (result.status === "completed") {
      return result; // Success!
    } else if (result.status === "failed") {
      throw new Error(`Generation failed: ${JSON.stringify(result.error)}`);
    }
    // status === "pending" - keep polling
  }
  
  throw new Error("Generation timed out");
}

// Usage
generateAndWait({
  inputText: "Create a presentation about renewable energy",
  textMode: "generate",
  format: "presentation",
  numCards: 8
}).then(result => {
  console.log(`Done! View at: ${result.gammaUrl}`);
});
```

{% endtab %}

{% tab title="cURL" %}

```bash
# Step 1: Start generation
GENERATION_ID=$(curl -s -X POST "https://public-api.gamma.app/v1.0/generations" \
  -H "X-API-KEY: sk-gamma-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "inputText": "Create a presentation about renewable energy",
    "textMode": "generate",
    "format": "presentation",
    "numCards": 8
  }' | jq -r '.generationId')

echo "Generation ID: $GENERATION_ID"

# Step 2: Poll until complete
while true; do
  sleep 5
  RESULT=$(curl -s "https://public-api.gamma.app/v1.0/generations/$GENERATION_ID" \
    -H "X-API-KEY: sk-gamma-xxxxx")
  
  STATUS=$(echo $RESULT | jq -r '.status')
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "Done! URL: $(echo $RESULT | jq -r '.gammaUrl')"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Failed: $(echo $RESULT | jq -r '.error')"
    exit 1
  fi
done
```

{% endtab %}
{% endtabs %}

### Using automation platforms

Popular automation platforms have built-in ways to handle delays and polling:

#### Zapier

Use the **Delay** action between your HTTP Request steps:

1. **HTTP Request** (POST) → Start generation, get `generationId`
2. **Delay for** → Wait 30-60 seconds
3. **HTTP Request** (GET) → Check status with the `generationId`
4. Use **Paths** or **Filter** to check if `status` equals `completed`
5. If still pending, use **Looping by Zapier** to repeat steps 2-4

Zapier's "Delay for" action pauses your Zap for a specified time (minimum 1 minute). For most Gamma generations, a single 60-second delay followed by a status check works well.

#### Make (formerly Integromat)

Use the **Sleep** module or a polling pattern:

1. **HTTP** module → POST to start generation
2. **Sleep** module → Wait 30 seconds
3. **HTTP** module → GET to check status
4. **Router** with filter → Check if `status` is `completed`
5. Use **Repeater** + **Sleep** for polling loop

#### n8n

Use the **Wait** node with time interval:

1. **HTTP Request** node → POST to start generation
2. **Wait** node → Set to "After Time Interval" (30-60 seconds)
3. **HTTP Request** node → GET to check status
4. **IF** node → Check `status === "completed"`
5. Loop back to Wait node if still pending

n8n's Wait node offloads execution data to the database during longer waits, so your workflow won't timeout even for complex generations.

### Best practices

* Use 5-second polling intervals. Polling more frequently will not speed up the generation and may increase the chance of rate limiting.
* Set a maximum timeout. Most generations complete within 2-3 minutes, so a 5-minute ceiling is a good default for automation.
* Handle all three states: `pending`, `completed`, and `failed`.
* Use exponential backoff if you receive a 429 response.

### Running multiple generations

You can start multiple generations in parallel. To manage throughput:

* Use the `x-ratelimit-remaining-burst` header on each response to pace your requests. See [Rate limit headers and adaptive polling](#rate-limit-headers-and-adaptive-polling) below for how to read these headers.
* Stagger your `POST /generations` calls and poll the resulting IDs round-robin rather than waiting for each generation to complete before starting the next.
* If responses slow down or you receive a `429`, back off and let the rate limit headers guide your pacing.

### Starting a generation without waiting

`POST /generations` returns a `generationId` immediately — you do not need to wait for the generation to finish inline. To poll later, all you need is your API key and the `generationId`.

This is useful for workflows that start a generation in one step and check the result in a later step. For example, a multi-step automation can fire off a generation, continue with other work, and come back to poll `GET /generations/{generationId}` when it is ready to use the result.

### Monitoring credit usage

The `credits` field (with `deducted` and `remaining`) appears on `completed` and `failed` poll responses. It is not included while the generation is still `pending`.

* Check `credits.remaining` after each completed generation before starting another.
* If credits run out, subsequent `POST /generations` calls return `403` with `"Insufficient credits remaining"`. Checking the remaining balance proactively avoids unexpected failures mid-workflow.
* Enable [auto-recharge](https://gamma.app/settings/billing) to avoid interruptions.

### Rate limit headers and adaptive polling

Every API response includes headers that show your current rate limit usage. Use these to adjust your polling speed dynamically instead of waiting for a `429` error.

To see these headers in curl, add the `-i` flag. You can also use `-v` for full verbose output including request headers and TLS details, but `-i` is cleaner for inspecting rate limits.

{% code title="curl -i example" %}

```bash
curl -i https://public-api.gamma.app/v1.0/generations/abc123 \
  -H "X-API-KEY: your-api-key"
```

{% endcode %}

{% code title="Response with headers" %}

```
HTTP/2 200
content-type: application/json
x-ratelimit-limit-burst: 10000
x-ratelimit-remaining-burst: 9994
x-ratelimit-limit: 40000
x-ratelimit-remaining: 39988
x-ratelimit-limit-daily: 200000
x-ratelimit-remaining-daily: 199950

{
  "generationId": "abc123",
  "status": "completed",
  "gammaUrl": "https://gamma.app/docs/abc123",
  "credits": {
    "deducted": 15,
    "remaining": 485
  }
}
```

{% endcode %}

Without `-i`, you'd only see the JSON body. The headers are always present — `-i` just tells curl to display them. In Python, JavaScript, or any HTTP client, these headers are always accessible on the response object without any special flag.

| Header                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `x-ratelimit-limit-burst`     | Maximum requests allowed in the current short window |
| `x-ratelimit-remaining-burst` | Requests remaining in the current short window       |
| `x-ratelimit-limit`           | Maximum requests allowed per hour                    |
| `x-ratelimit-remaining`       | Requests remaining in the current hour               |
| `x-ratelimit-limit-daily`     | Maximum requests allowed per day                     |
| `x-ratelimit-remaining-daily` | Requests remaining today                             |

#### Adaptive polling example

Instead of a fixed 5-second interval, read `x-ratelimit-remaining-burst` and slow down when capacity is low:

{% tabs %}
{% tab title="Python" %}

```python
remaining = int(status_response.headers.get("X-RateLimit-Remaining-Burst", 9999))

if remaining < 100:
    poll_interval = 15
else:
    poll_interval = 5

time.sleep(poll_interval)
```

{% endtab %}

{% tab title="JavaScript" %}

```javascript
const remaining = parseInt(
  statusResponse.headers.get("X-RateLimit-Remaining-Burst") ?? "9999"
);

const pollInterval = remaining < 100 ? 15000 : 5000;
await sleep(pollInterval);
```

{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Generation time varies.** Larger decks, AI-generated images, and higher-quality image models all increase generation time. A 5-card deck with no images may complete in under a minute, while a 40-card deck with AI images could take several minutes. Factor this into your timeout and polling logic — there is no single "right" interval for all requests.
{% endhint %}

#### Handling a 429 response

If you hit the rate limit, the API returns `429 Too Many Requests`. Pause for 30 seconds before retrying, then use exponential backoff if subsequent requests also return `429`.

### Common issues

#### `status` stays `pending` for too long

Generations typically complete in 1-3 minutes. If you are waiting longer than 5 minutes:

* Check that you're polling the correct `generationId`
* Verify your API key has sufficient credits
* Try generating with fewer cards (`numCards`) to test

#### You receive a 429 rate-limit response

If you receive a 429 error:

* Use 5+ second polling intervals
* Use `curl -i` to check the `x-ratelimit-remaining-burst` header and see if you're near the limit
* See [Rate limit headers and adaptive polling](#rate-limit-headers-and-adaptive-polling) above for how to throttle dynamically
* If you're using Zapier, Make, or n8n, the rate limit may be on the platform side rather than Gamma's

### Related

* [Error codes](https://developers.gamma.app/reference/error-codes) for the full list of API errors and troubleshooting guidance
* [Generate from text](https://developers.gamma.app/guides/generate-api-parameters-explained) for parameter-level guidance on `POST /v1.0/generations`
* [Charts and structured content](https://developers.gamma.app/guides/charts-and-structured-content) for prompting charts and infographics
* [Image URL best practices](https://developers.gamma.app/guides/image-url-best-practices) for including your own images
* [API Overview](https://developers.gamma.app/get-started/understanding-the-api-options) for a broader workflow comparison
