# Generate from template

Use this page when you want `POST /v1.0/generations/from-template` and need help choosing the parameters that preserve layout while swapping in new content.

{% hint style="info" %}
This page is for workflow guidance and parameter tradeoffs. For the exact request body, field types, and polling response schema, see the [POST /generations/from-template](https://developers.gamma.app/generations/create-from-template) and [GET /generations/{id}](https://developers.gamma.app/generations/get-generation-status) endpoint reference pages.
{% endhint %}

### Quick reference

* `gammaId` and `prompt` are required.
* The template Gamma must contain exactly one page.
* Use `themeId`, `folderIds`, `exportAs`, and `sharingOptions` the same way you would in the standard generation flow.
* Poll `GET /v1.0/generations/{generationId}` to retrieve `gammaUrl`, `exportUrl`, and credit usage.

### Top-level parameters

#### `gammaId` *(required)*

Identifies the template you want to modify. You can find and copy the gammaId for a template as shown in the screenshots below.

{% columns %}
{% column %}

<figure><img src="https://2814591912-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FupsTVd2JbSOFZRBjfqED%2Fuploads%2Fgit-blob-3311bf6d1add2d51d8a52afbce4b9d787acf68d8%2Ftemplate-gamma-id.png?alt=media" alt="Finding the gamma ID for a template" width="50%"><figcaption><p>Copy the template Gamma ID from the app before you make the request.</p></figcaption></figure>
{% endcolumn %}

{% column %}

<figure><img src="https://2814591912-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FupsTVd2JbSOFZRBjfqED%2Fuploads%2Fgit-blob-5277e3dccf1d9b41818e2ea89e90beaca839fcd8%2Ftemplate-one-page.png?alt=media" alt="Template must have exactly one page" width="50%"><figcaption><p>Create from Template works best when the source Gamma has exactly one page.</p></figcaption></figure>
{% endcolumn %}
{% endcolumns %}

***

#### `prompt` *(required)*

Use this parameter to send text content, image URLs, as well as instructions for how to use this content in relation to the template gamma.

**Add images to the input**

You can provide URLs for specific images you want to include. Simply insert the URLs into your content where you want each image to appear (see example below). You can also add instructions for how to display the images, eg, "Group the last 10 images into a gallery to showcase them together."

**Token limits**

The total token limit is 100,000, which is approximately 400,000 characters, but because part of your input is the gamma template, in practice, the token limit for your prompt becomes shorter. We highly recommend keeping your prompt well below 100,000 tokens and testing out a variety of inputs to get a good sense of what works for your use case.

**Other tips**

* Text can be as little as a few words that describe the topic of the content you want to generate.
* You can also input longer text -- pages of messy notes or highly structured, detailed text.
* You may need to apply JSON escaping to your text. Find out more about JSON escaping and [try it out here](https://www.devtoolsdaily.com/json/escape/).

{% code title="Example" %}

```json
"prompt": "Change this pitch deck about deep sea exploration into one about space exploration."
```

{% endcode %}

{% code title="Example" %}

```json
"prompt": "Change this pitch deck about deep sea exploration into one about space exploration. Use this quote and this image in the title card: That's one small step for man, one giant leap for mankind - Neil Armstrong, https://www.global-aero.com/wp-content/uploads/2020/06/ga-iss.jpg"
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

#### imageOptions

When you create content from a Gamma template, new images automatically match the image source used in the original template. For example if you used Pictographic images to generate your original template, any new images will be sourced from Pictographic.

For templates with AI-generated images, you can override the default AI image settings using the optional parameters below.

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

* [Generate from text](https://developers.gamma.app/guides/generate-api-parameters-explained) if you want Gamma to determine the layout from scratch
* [Poll for results](https://developers.gamma.app/guides/async-patterns-and-polling) for the polling flow after template generation starts
* [API Overview](https://developers.gamma.app/get-started/understanding-the-api-options) for a side-by-side comparison of generation workflows
