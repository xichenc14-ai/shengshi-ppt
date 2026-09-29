# Parameter selection

Use explicit user choices exactly when supported. Otherwise infer the smallest reasonable presentation and record the final choices in `config.json`. Theme selection is handled by the bundled deterministic matcher, using the same catalog as the website. Keep the user's design instruction separate from factual slide content.

## Defaults

```json
{
  "format": "presentation",
  "dimensions": "16x9",
  "textMode": "preserve",
  "tone": "professional",
  "audience": "general",
  "language": "zh-cn",
  "textAmount": "medium",
  "themeId": "auto",
  "themePrompt": "",
  "themeScene": "",
  "imageSource": "themeAccent",
  "externalAccess": "view"
}
```

The number of `---`-separated Markdown sections determines the page count. Do not add `numCards` unless the input has no explicit page breaks.

## Theme routing

Set `themePrompt` to the user's visual request, for example `不要粉色，白底专业的医疗研究报告`. Set `themeScene` to the main use, such as `医疗健康` or `商务汇报`. If no visual request was supplied, leave `themePrompt` empty; the runner uses the title and scene as soft signals without treating color words in the title as design commands. Set `themeId` to a verified ID only when the user chose that exact theme. The runner writes the selected ID, reason, evidence, and candidate ranking to `theme-decision.json` before submitting Gamma, then confirms that ID against the current account's paginated `GET /themes` response before creating a task.

The first candidate tier contains the eight curated themes: `pearl`, `twilight`, `lux`, `atmosphere`, `finesse`, `icebreaker`, `marine`, and `gold-leaf`. Hard color exclusions and explicit theme choices take precedence. Other validated themes are considered when no curated theme fits. If requirements conflict, stop before creating a Gamma task and report the conflict.

## Practical scene guidance

Pass the use case through `themeScene` rather than preselecting an ID: `商务汇报`, `研究报告`, `科技AI`, `教育课件`, `培训课件`, `医疗健康`, `旅游出行`, `餐饮美食`, `高端品牌`, `文化教育`, or `生活方式`. Keep audience and text density in the config: for example, `audience: "董事会"` with `textAmount: "detailed"` helps distinguish a dense management report from a photographic brand presentation. The matcher scores purpose, audience, density, style, and palette; those profile fits are routing hypotheses and still need rendered-slide review.

## Image sources

- `themeAccent`: default; use Gamma theme-native visual accents.
- `pictographic`: Gamma's illustration-oriented image source. It can improve overall visual density, but it does not assign a semantic icon to each point; keep an explicit user image-source choice.
- `pexels`: photographic material suited to travel, lifestyle, people, or physical environments.
- `noImages`: text, charts, diagrams, or confidential/internal material where imagery adds little.
- `aiGenerated`: Gamma's own generated imagery. Use only when explicitly requested or clearly justified.

Do not choose `aiGenerated` merely because the deck should look polished. Prefer layouts, icons, shapes, diagrams, and theme accents.

## Page-count guidance

- A user-specified page count is binding unless technically impossible.
- A short topic with no requested count normally uses 6–8 slides.
- A proposal, report, or source document normally uses 8–12 slides.
- Cover and closing slides count toward the total.
- Keep each content slide focused on one message with 2–4 supporting points.
