# Generate from text

Use this page when you already know you want `POST /v1.0/generations` and need help deciding how each parameter affects the output.

{% hint style="info" %}
This page explains when and why to use each parameter. For the exact request body, field types, and response schema, see the [POST /generations](https://developers.gamma.app/generations/create-generation) and [GET /generations/{id}](https://developers.gamma.app/generations/get-generation-status) endpoint reference pages.
{% endhint %}

### Quick reference

* `inputText` is always required.
* `textMode` controls whether Gamma expands, condenses, or preserves your source text.
* `format`, `themeId`, `imageOptions`, and `cardOptions` shape the look and output type.
* Poll `GET /v1.0/generations/{generationId}` to retrieve `gammaUrl`, `exportUrl`, and credit usage after creation.

### Top-level parameters

#### `inputText` *(required)*

Content used to generate your gamma, including text and image URLs.

**Add images to the input**

You can provide URLs for specific images you want to include. Simply insert the URLs into your content where you want each image to appear (see example below). You can also add instructions for how to display the images in `additionalInstructions`, eg, "Group the last 10 images into a gallery to showcase them together."

{% hint style="info" %}
**Note:** If you want your gamma to use *only* the images you provide (and not generate additional ones), set `imageOptions.source` to `noImages`.
{% endhint %}

**Token limits**

The token limit is 100,000, which is approximately 400,000 characters. However, in some cases, the token limit may be lower, especially if your use case requires extra reasoning from our AI models. We highly recommend keeping inputText below 100,000 tokens and testing out a variety of inputs to get a good sense of what works for your use case.

**Other tips**

* Text can be as little as a few words that describe the topic of the content you want to generate.
* You can also input longer text -- pages of messy notes or highly structured, detailed text.
* You can control where cards are split by adding \n---\n to the text.
* You may need to apply JSON escaping to your text. Find out more about JSON escaping and [try it out here](https://www.devtoolsdaily.com/json/escape/).

{% code title="Example" %}

```json
"inputText": "Ways to use AI for productivity"
```

{% endcode %}

{% code title="Example" %}

```json
"inputText": "# The Final Frontier: Deep Sea Exploration\n* Less than 20% of our oceans have been explored\n* Deeper than 1,000 meters remains largely mysterious\n* More people have been to space than to the deepest parts of our ocean\n\nhttps://img.genially.com/5b34eda40057f90f3a45b977/1b02d693-2456-4379-a56d-4bc5e14c6ae1.jpeg\n---\n# Technological Breakthroughs\n* Advanced submersibles capable of withstanding extreme pressure\n* ROVs (Remotely Operated Vehicles) with HD cameras and sampling tools\n* Autonomous underwater vehicles for extended mapping missions\n* Deep-sea communication networks enabling real-time data transmission\n\nhttps://images.encounteredu.com/excited-hare/production/uploads/subject-update-about-exploring-the-deep-hero.jpg?w=1200&h=630&q=82&auto=format&fit=crop&dm=1631569543&s=48f275c76c565fdaa5d4bd365246afd3\n---\n# Ecological Discoveries\n* Unique ecosystems thriving without sunlight\n* Hydrothermal vent communities using chemosynthesis\n* Creatures with remarkable adaptations: bioluminescence, pressure resistance\n* Thousands of new species discovered annually\n---\n# Scientific & Economic Value\n* Understanding climate regulation and carbon sequestration\n* Pharmaceutical potential from deep-sea organisms\n* Mineral resources and rare earth elements\n* Insights into extreme life that could exist on other planets\n\nhttps://publicinterestnetwork.org/wp-content/uploads/2023/11/Western-Pacific-Jarvis_PD_NOAA-OER.jpg\n---\n# Future Horizons\n* Expansion of deep-sea protected areas\n* Sustainable exploration balancing discovery and conservation\n* Technological miniaturization enabling broader coverage\n* Citizen science initiatives through shared deep-sea data"
```

{% endcode %}

***

#### `textMode` *(required)*

Determines how your `inputText` is modified, if at all.

* You can choose between `generate`, `condense`, or `preserve`
* `generate`: Using your `inputText` as a starting point, Gamma will rewrite and expand the content. Works best when you have brief text in the input that you want to elaborate on.
* `condense`: Gamma will summarize your `inputText` to fit the content length you want. Works best when you start with a large amount of text that you'd like to summarize.
* `preserve`: Gamma will retain the exact text in `inputText`, sometimes structuring it where it makes sense to do so, eg, adding headings to sections. (If you do not want any modifications at all, you can specify this in the `additionalInstructions` parameter.)

{% code title="Example" %}

```json
"textMode": "generate"
```

{% endcode %}

***

#### `format` *(optional, defaults to`presentation`)*

Determines the artifact Gamma will create for you.

* You can choose between `presentation`, `document`, `social`, or `webpage`.
* You can use the `cardOptions.dimensions`field to further specify the shape of your output.

{% code title="Example" %}

```json
"format": "presentation"
```

{% endcode %}

***

#### `themeId` *(optional, defaults to workspace default theme)*

Defines which theme from Gamma will be used for the output. Themes determine the look and feel of the gamma, including colors and fonts.

* Use [`GET /v1.0/themes`](https://developers.gamma.app/workspace/list-themes) to list themes from your workspace, or copy the theme ID directly from the app.

<figure><img src="https://2814591912-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FupsTVd2JbSOFZRBjfqED%2Fuploads%2Fgit-blob-fa7e3303a649cb63469a0ee41bb8671efd173dfe%2Ftheme-id-location.png?alt=media" alt="Theme ID location in Gamma" width="75%"><figcaption><p>Copy the theme ID from the app</p></figcaption></figure>

{% code title="Example" %}

```json
"themeId": "abc123def456ghi"
```

{% endcode %}

***

#### `numCards` *(optional, defaults to`10`)*

Determines how many cards are created if `auto` is chosen in `cardSplit`

* Pro, Teams, and Business plans: 1 to 60 cards.
* Ultra plan: 1 to 75 cards.

{% code title="" %}

```json
"numCards": 10
```

{% endcode %}

***

#### `cardSplit` *(optional, defaults to`auto`)*

Determines how your content will be divided into cards.

* You can choose between `auto` or `inputTextBreaks`
* Choosing `auto` tells Gamma to looks at the `numCards` field and divide up content accordingly. (It will not adhere to text breaks \n---\n in your `inputText`.)
* Choosing `inputTextBreaks` tells Gamma that it should look for text breaks \n---\n in your `inputText` and divide the content based on this. (It will not respect `numCards`.)
  * Note: One \n---\n = one break, ie, text with one break will produce two cards, two break will produce three cards, and so on.
* Here are some scenarios to guide your use of these parameters and explain how they work

| inputText contains \n---\n and how many | cardSplit       | numCards   | output has         |
| --------------------------------------- | --------------- | ---------- | ------------------ |
| No                                      | auto            | 9          | 9 cards            |
| No                                      | auto            | left blank | 10 cards (default) |
| No                                      | inputTextBreaks | 9          | 1 card             |
| Yes, 5                                  | auto            | 9          | 9 cards            |
| Yes, 5                                  | inputTextBreaks | 9          | 6 cards            |

```json
"cardSplit": "auto"
```

***

#### `additionalInstructions` *(optional)*

Helps you add more specifications about your desired output.

* You can add specifications to steer content, layouts, and other aspects of the output.
* Works best when the instructions do not conflict with other parameters, eg, if the `textMode` is defined as `condense`, and the `additionalInstructions` say to preserve all text, the output will not be able to respect these conflicting requests.
* Character limits: 1-5000.

```json
"additionalInstructions": "Make the card headings humorous and catchy"
```

{% hint style="success" %}
**Pro tip: Use `additionalInstructions` for aesthetic feedback**

This field is especially powerful for specific visual and stylistic guidance that doesn't fit elsewhere:

* **Layout preferences**: "Use a gallery layout for the product images", "Keep text on the left side of cards"
* **Visual style**: "Make it feel modern and minimalist", "Use bold colors and dynamic compositions"
* **Tone adjustments**: "Make headlines punchy and attention-grabbing", "Keep the overall vibe professional but approachable"
* **Specific formatting**: "Use bullet points instead of paragraphs", "Include a summary card at the end"

The more specific you are, the better the results!
{% endhint %}

***

#### `folderIds` *(optional)*

Defines which folder(s) your gamma is stored in.

* Use [`GET /v1.0/folders`](https://developers.gamma.app/workspace/list-folders) to list folders, or copy the folder ID directly from the app.
* You must be a member of a folder to add gammas to it.

<figure><img src="https://2814591912-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FupsTVd2JbSOFZRBjfqED%2Fuploads%2Fgit-blob-f774b6fae863941c879946333efd471c18e8ad49%2Ffolder-id-location.png?alt=media" alt="Folder ID location in Gamma" width="75%"><figcaption><p>Copy the folder ID from the app</p></figcaption></figure>

```json
"folderIds": ["123abc456def", "456123abcdef"]
```

***

#### `exportAs` *(optional)*

Indicates if you'd like to return the generated gamma as an exported file as well as a Gamma URL.

* Options are `pdf`, `pptx`, or `png`
* Export URLs are signed and expire after approximately one week. Download promptly after generation completes.
* If you do not wish to directly export via the API, you may always do so later via the app.

{% hint style="warning" %}
**One export format per request.** You can export to PDF, PPTX, or PNG, but not multiple formats in a single API call. If you need multiple formats, make separate generation requests or export additional formats manually from the Gamma app.
{% endhint %}

{% code title="Example" %}

```json
"exportAs": "pdf"
```

{% endcode %}

***

#### textOptions

**`textOptions.amount`** *(optional, defaults to `medium`)*

Influences how much text each card contains. Relevant only if `textMode` is set to `generate` or `condense`.

* You can choose between `brief`, `medium`, `detailed` or `extensive`

{% code title="Example" %}

```json
"textOptions": {
    "amount": "detailed"
  }
```

{% endcode %}

**`textOptions.tone`** *(optional)*

Defines the mood or voice of the output. Relevant only if `textMode` is set to `generate`.

* You can add one or multiple words to hone in on the mood/voice to convey.
* Character limits: 1-500.

{% code title="Example" %}

```json
"textOptions": {
    "tone": "neutral"
  }
```

{% endcode %}

{% code title="Example" %}

```json
"textOptions": {
    "tone": "professional, upbeat, inspiring"
  }
```

{% endcode %}

**`textOptions.audience`** *(optional)*

Describes who will be reading/viewing the gamma, which allows Gamma to cater the output to the intended group. Relevant only if `textMode` is set to `generate`.

* You can add one or multiple words to hone in on the intended viewers/readers of the gamma.
* Character limits: 1-500.

{% code title="Example" %}

```json
"textOptions": {
    "audience": "outdoors enthusiasts, adventure seekers"
  }
```

{% endcode %}

{% code title="Example" %}

```json
"textOptions": {
    "audience": "seven year olds"
  }
```

{% endcode %}

**`textOptions.language`** *(optional, defaults to `en`)*

Determines the language in which your gamma is generated, regardless of the language of the `inputText`.

* You can choose from the languages listed in [Output language accepted values](https://developers.gamma.app/reference/output-language-accepted-values).

{% code title="Example" %}

```json
"textOptions": {
    "language": "en"
  }
```

{% endcode %}

***

#### imageOptions

**`imageOptions.source`** *(optional, defaults to `aiGenerated`)*

Determines where the images for the gamma are sourced from. You can choose from the options below. If you are providing your own image URLs in `inputText` and want only those to be used, set `imageOptions.source` to `noImages` to indicate that Gamma should not generate additional images.

| Options for `source`       | Notes                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiGenerated`              | If you choose this option, you can also specify the `imageOptions.model` you want to use as well as an `imageOptions.style`. These parameters do not apply to other `source` options. |
| `pictographic`             | Pulls images from Pictographic.                                                                                                                                                       |
| `pexels`                   | Gets images from Pexels.                                                                                                                                                              |
| `giphy`                    | Gets GIFs from Giphy.                                                                                                                                                                 |
| `webAllImages`             | Pulls the most relevant images from the web, even if licensing is unknown.                                                                                                            |
| `webFreeToUse`             | Pulls images licensed for personal use.                                                                                                                                               |
| `webFreeToUseCommercially` | Gets images licensed for commercial use, like a sales pitch.                                                                                                                          |
| `themeAccent`              | Uses accent images from your selected theme.                                                                                                                                          |
| `placeholder`              | Creates a gamma with placeholders for which images can be manually added later.                                                                                                       |
| `noImages`                 | Creates a gamma with no images. Select this option if you are providing your own image URLs in `inputText` and want only those in your gamma.                                         |

{% code title="Example" %}

```json
"imageOptions": {
    "source": "aiGenerated"
  }
```

{% endcode %}

**`imageOptions.model`** *(optional)*

This field is relevant if the `imageOptions.source` chosen is `aiGenerated`. The `imageOptions.model` parameter determines which model is used to generate images.

* You can choose from the models listed in [Image model accepted values](https://developers.gamma.app/reference/image-model-accepted-values).
* If no value is specified for this parameter, Gamma automatically selects a model for you.

{% code title="Example" %}

```json
"imageOptions": {
	"model": "flux-1-pro"
  }
```

{% endcode %}

**`imageOptions.style`** *(optional)*

This field is relevant if the `imageOptions.source` chosen is `aiGenerated`. The `imageOptions.style` parameter influences the artistic style of the images generated. While this is an optional field, we highly recommend adding some direction here to create images in a cohesive style.

* You can add one or multiple words to define the visual style of the images you want.
* Adding some direction -- even a simple one word like "photorealistic" -- can create visual consistency among the generated images.
* Character limits: 1-500.

{% code title="Example" %}

```json
"imageOptions": {
	"style": "minimal, black and white, line art"
  }
```

{% endcode %}

**`imageOptions.stylePreset`** *(optional)*

Instead of writing a free-text `style` string, you can choose a built-in art style preset. Each named preset applies a curated style prompt that produces a consistent visual look across all generated images.

| Preset           | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `photorealistic` | Highly detailed, cinematic, professional photography                         |
| `illustration`   | Modern vector illustration with clean linework and flat color fills          |
| `abstract`       | Non-representational abstract art with flowing gradients and geometric forms |
| `3D`             | 3D-rendered style                                                            |
| `lineArt`        | Clean, minimal line art in pictographic style                                |
| `custom`         | Uses your `imageOptions.style` string as the prompt (default behavior)       |

* If you omit `stylePreset`, the default is `custom` -- existing behavior is unchanged.
* When a named preset (anything other than `custom`) is used, the `style` field is ignored and the API returns a warning.
* To combine a preset with your own direction, use `custom` and provide a `style` string.

{% code title="Example — named preset" %}

```json
"imageOptions": {
	"stylePreset": "illustration",
	"source": "aiGenerated"
  }
```

{% endcode %}

{% code title="Example — custom style (default)" %}

```json
"imageOptions": {
	"stylePreset": "custom",
	"style": "watercolor, soft edges, muted tones"
  }
```

{% endcode %}

**What about accent images?**

{% hint style="info" %}
**Accent images are automatically placed by Gamma** - they cannot be directly controlled via the API.

Accent images are large, decorative images that enhance the visual appeal of cards. Gamma's AI automatically determines:

* **Whether** to include an accent image on each card
* **Where** to place it (left, right, top, or background)
* **What** image to use (based on your content and `imageOptions` settings)

The placement works best with fixed-dimension formats like `16x9` presentations. If you need more control over images, consider providing specific image URLs directly in your `inputText`.
{% endhint %}

**Providing your own image URLs**

When including image URLs in your `inputText`, follow these best practices to avoid broken images:

{% hint style="warning" %}
**Use long-lived or permanent URLs**

Gamma stores references to your image URLs. If the URL expires or becomes inaccessible, the image will appear broken in your presentation.

**For S3/Cloud Storage signed URLs:**

* Set expiration to **at least 7 days** (longer is better)
* Consider using permanent public URLs or CDN links instead
* Test that URLs are accessible before submitting

**Avoid:**

* Short-lived signed URLs (< 24 hours)
* URLs that require authentication headers
* Localhost or internal network URLs
  {% endhint %}

| URL Type                            | Recommended | Notes                              |
| ----------------------------------- | ----------- | ---------------------------------- |
| Public CDN (Cloudflare, CloudFront) | ✅ Yes       | Permanent, fast, reliable          |
| S3 signed URL (7+ days)             | ✅ Yes       | Works if expiration is long enough |
| S3 signed URL (< 24 hours)          | ❌ No        | Will break after expiration        |
| Google Drive/Dropbox share links    | ⚠️ Maybe    | Can break if permissions change    |
| Imgur, hosted image services        | ✅ Yes       | Generally permanent                |
| Localhost / 192.168.x.x             | ❌ No        | Not accessible to Gamma servers    |

{% hint style="success" %}
**Testing your URLs**: Before submitting a generation request, open each image URL in an incognito browser window. If you can see the image without logging in, Gamma can access it too.
{% endhint %}

***

#### cardOptions

**`cardOptions.dimensions`** *(optional)*

Determines the aspect ratio of the cards to be generated. Fluid cards expand with your content. Not applicable if `format` is `webpage`.

* Options if `format` is `presentation`: `fluid` **(default)**, `16x9`, `4x3`
* Options if `format` is `document`: `fluid` **(default)**, `pageless`, `letter`, `a4`
* Options if `format` is `social`: `1x1`, `4x5`**(default)** (good for Instagram posts and LinkedIn carousels), `9x16` (good for Instagram and TikTok stories)

{% hint style="warning" %}
**Only the values listed above are accepted** — custom ratios or pixel dimensions are not supported. The `dimensions` value must also be valid for the chosen `format`. If they don't match, the API applies a default for that format and includes a warning in the response.
{% endhint %}

{% code title="Example" %}

```json
"cardOptions": {
  "dimensions": "16x9"
}
```

{% endcode %}

**`cardOptions.headerFooter`** *(optional)*

Allows you to specify elements in the header and footer of the cards. Not applicable if `format` is `webpage`.

* Step 1: Pick which positions you want to populate. Options: `topLeft`, `topRight`, `topCenter`, `bottomLeft`, `bottomRight`, `bottomCenter`.
* Step 2: For each position, specify what type of content goes there. Options: `text`, `image`, and `cardNumber`.
* Step 3: Configure based on type.
  * For `text`, define a `value` (required)
  * For `image`:
    * Set the `source`. Options: `themeLogo` or `custom`image (required)
    * Set the `size` . Options:`sm`, `md`, `lg`, `xl` (optional)
    * For a`custom` image, define a `src` image URL (required)
  * For `cardNumber`, no additional configuration is available.
* Step 4: For any position, you can control whether it appears on the first or last card:
  * `hideFromFirstCard` (optional) - Set to `true` to hide from first card. Default: `false`
  * `hideFromLastCard` (optional) - Set to `true` to hide from last card. Default: `false`

{% code title="Example" %}

```json
"cardOptions": {
    "headerFooter": {
      "topRight": {
        "type": "image",
        "source": "themeLogo",
        "size": "sm"
      },
      "bottomRight": {
        "type": "cardNumber"
      },
      "hideFromFirstCard": true
    }
}
```

{% endcode %}

{% code title="Example" %}

```json
"cardOptions": {
    "headerFooter": {
      "topRight": {
        "type": "image",
        "source": "custom",
        "src": "https://example.com/logo.png",
        "size": "md"
      },
      "bottomRight": {
        "type": "text",
        "value": "© 2026 Company™"
      },
      "hideFromFirstCard": true,
      "hideFromLastCard": true
    }
}
```

{% endcode %}

***

#### sharingOptions

**`sharingOptions.workspaceAccess`** *(optional, defaults to workspace share settings)*

Determines level of access members in your workspace will have to your generated gamma.

* Options are: `noAccess`, `view`, `comment`, `edit`, `fullAccess`
* `fullAccess`allows members from your workspace to view, comment, edit, and share with others.

```json
"sharingOptions": {
	"workspaceAccess": "comment"
}
```

**`sharingOptions.externalAccess`** *(optional, defaults to workspace share settings)*

Determines level of access members **outside your workspace** will have to your generated gamma.

* Options are: `noAccess`, `view`, `comment`, or `edit`

{% code title="Example" %}

```json
"sharingOptions": {
	"externalAccess": "noAccess"
}
```

{% endcode %}

**`sharingOptions.emailOptions`** *(optional)*

Allows you to share your gamma with specific recipients via their email address.

{% code title="Example" %}

```json
"sharingOptions": {
  "emailOptions": {
    "recipients": ["ceo@example.com", "cto@example.com"]
  }
}
```

{% endcode %}

**`sharingOptions.emailOptions.access`** *(optional)*

Determines level of access those specified in `sharingOptions.emailOptions.recipients` have to your generated gamma. Only workspace members can have `fullAccess`

* Options are: `view`, `comment`, `edit`, or `fullAccess`

{% code title="Example" %}

```json
"sharingOptions": {
  "emailOptions": {
    "access": "comment"
  }
}
```

{% endcode %}

### Related

* [Generate from a template](https://developers.gamma.app/guides/create-from-template-api-parameters-explained) if you want to preserve an existing layout
* [Poll for results](https://developers.gamma.app/guides/async-patterns-and-polling) for the post-request workflow
* [Header and Footer Formatting](https://developers.gamma.app/guides/header-and-footer-formatting) for deeper guidance on `cardOptions.headerFooter`
