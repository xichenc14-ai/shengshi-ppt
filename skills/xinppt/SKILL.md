---
name: xinppt
description: Create a polished PowerPoint from a topic or local source materials using the personal XinPPT smart workflow and a locally configured Gamma API key. Use when the user wants省心PPT、一句话生成PPT、自动选主题/语气/配图参数，或继续一个本地 Gamma 生成任务. Does not use the XinPPT website, accounts, billing, or GPT image generation.
metadata:
  version: "1.0.0"
---

# XinPPT

Create the presentation locally. The agent prepares the content and parameters; `scripts/xinppt.mjs` submits, resumes, exports, downloads, and validates the Gamma artifact.

Resolve every `scripts/`, `references/`, and `assets/` path relative to this `SKILL.md`, regardless of the current project directory. Run the command examples below from the skill directory, or replace `scripts/...` with its absolute path.

## Workflow

1. Inspect the user's topic and any supplied local materials. Extract only supported facts; do not invent missing figures, quotations, or claims.
2. Resolve parameters with this precedence: explicit user request, source-material constraints, inferred choice, default. For theme selection, set `themeId: "auto"` and put only the user's actual design request in `themePrompt`; put the subject in the outline title and add `themeScene` when the presentation purpose is known. If the user chose a named theme, set its exact ID in `themeId`. The runner uses the bundled 48-theme catalog, prioritizes eligible recommended themes, and rejects conflicting hard requirements. It checks the selected ID against the current Gamma account before a live submit. Read [references/parameters.md](references/parameters.md) when choosing theme, tone, page count, or image source.
3. Build a per-slide `outline.json` as the source of truth. Each slide has `title`, `content` (finished points), `visualType`, `layoutIntent`, and 2–5 concise Chinese `iconHints` where useful. Add `chartSpec` only for real data and `diagramSpec` for processes or relationships. The runner writes `input.md` from this outline using the site's `Gamma可视化约束` format. Read [references/content-format.md](references/content-format.md).
4. Create a new output directory and run `node scripts/xinppt.mjs create --outline <outline.json> --config <config.json> --output-dir <dir>`. If the user wants to review the prepared prompt first, run `prepare` with the same arguments and stop before `create`. A new generation requests PPTX in the same Gamma request (`exportAs: pptx`); `resume` retrieves its URL by the saved generation ID without creating a separate export. The task directory preserves `outline.json`, the generated `input.md`, resolved `config.json`, `theme-decision.json` (without secrets), and Gamma's unmodified export at `diagnostics/gamma-original.pptx`.
5. Apply the website's PPTX-safe icon strategy during generation: pass each page's visual intent to Gamma, forbid fragile web icon libraries and remote assets, and use Gamma-native layouts, number badges, color blocks, Unicode marks, and simple vector shape combinations. If Gamma exports an SVG icon override alongside its own embedded PNG/JPEG fallback, the runner selects that existing raster fallback for offline compatibility. It never selects or inserts local replacement icons; Gamma's untouched export remains in `diagnostics/`.
6. If a known task was interrupted, read `job.json` first. When it contains a generation ID, run `node scripts/xinppt.mjs resume --job <job.json>`; never create another task. For a creation failure, report Gamma's recorded HTTP status, message, `x-request-id`, and stage. A 400/401/402/403/429 response is a concrete Gamma rejection, not an unknown network failure. Report material `createWarnings` when generation succeeds. If no HTTP response or generation ID was received, say that explicitly; do not infer a 400 or ask the user to diagnose an error code the runner never saw. Legacy tasks with an uncertain independent export and no export ID remain blocked; do not create that export again automatically.
7. Read `audit.json` and inspect every rendered slide before delivery. On macOS, if using the bundled LibreOffice, render with `scripts/render_pptx.py` and its explicit system-font configuration; a default headless render can hide Chinese even when the PPTX is intact. Compare with native preview when available. Confirm that content pages have visible visual structure and that no broken icon or empty image slot remains. Deliver the validated `.pptx`, plus the actual theme, image source, page count, and any material limitation.

## Interaction

Default to省心模式: infer reasonable parameters and proceed. Ask only when a missing choice would materially change the result. If the user asks to review the outline first, stop after writing `input.md` and `config.json`.

Do not invoke GPT image generation or the ChatGPT web bridge. `imageOptions.source: aiGenerated` means Gamma's own image option and is allowed only when the user requests it or the source material clearly calls for it.

## Execution constraints

- Run `node scripts/xinppt.mjs preflight` before the first live generation in a session.
- On macOS, the one-time create request uses the system `curl` command so it can use the machine's HTTP/2 network path. Keep `curl` available. The key is passed to `curl` through a private pipe, not a command-line argument or task file.
- Read the API key only from `GAMMA_API_KEY`, `XINPPT_CONFIG`, or `~/.config/xinppt/config.json`. Never copy a key into the task directory, skill, logs, or response.
- A failed or ambiguous create request is not safe to retry automatically. Preserve the local task files and distinguish an HTTP rejection from a transport failure. On HTTP rejection, use `job.json`'s `createResponse` and `errorAdvice` to explain the actionable cause; do not ask the user to check Gamma for that response. On a transport failure with no generation ID, report the specific limit of available evidence without claiming a Gamma status. If a known generation lacks `exportUrl`, repeat only its read-only status query; never create another generation or independent export automatically.
- The website, Next.js server, login, membership, credits, payments, Supabase, and project database are outside this workflow.
- A result is complete only when the PPTX ZIP structure, slide count, embedded media relationships, and visual output have been checked. The runner writes `audit.json`; inspect it and render the slides before delivery.

## Script commands

```bash
node scripts/xinppt.mjs preflight
node scripts/xinppt.mjs validate --outline outline.json --config config.json
node scripts/xinppt.mjs prepare --outline outline.json --config config.json --output-dir output
node scripts/xinppt.mjs create --outline outline.json --config config.json --output-dir output
# Legacy Markdown entry remains supported:
node scripts/xinppt.mjs create --input input.md --config config.json --output-dir output
node scripts/xinppt.mjs resume --job output/job.json
node scripts/xinppt.mjs verify --job output/job.json
node scripts/xinppt.mjs inspect --job output/job.json
# For macOS LibreOffice visual QA, supply the bundled soffice path:
python3 scripts/render_pptx.py output/deck.pptx output/render --soffice /absolute/path/to/bundled/soffice
```

Choose concrete semantic hints in the same order as the points, such as `放大镜查看数据`, `两人协作`, `盾牌保护`, or `包裹交付`, and describe the intended native layout. `iconHints` guide Gamma's visual design; they do not map to local icon files. Report weak visual results honestly after rendering rather than adding new icons to the PPTX after export.
