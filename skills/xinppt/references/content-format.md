# Slide content format

Write finished content rather than an outline that asks Gamma to invent facts. Each section is one slide and page separators must be standalone lines. For the preferred `outline.json` input, give each slide `visualType`, `layoutIntent`, and 2–5 Chinese `iconHints` where useful. The runner adds one `Gamma可视化约束` note per slide, following the website's `visualType / layoutIntent / iconHints / chartSpec / diagramSpec` convention.

```markdown
# Presentation title

Concise subtitle or context

---

## Executive summary

- First complete, concrete point
- Second complete, concrete point
- Third complete, concrete point

---

## Recommended action

1. First action with an owner or result
2. Second action with an owner or result
3. Third action with an owner or result
```

Use a cover, a clear narrative sequence, and a closing slide. Keep content concise enough for 16:9 slides. Preserve meaningful facts from source material and label uncertainty. Use tables only for genuine comparison; use charts only when source data is available. Never fabricate metrics to make a chart look complete.

For slides needing a particular structure, add a short visible instruction after the heading, such as `布局：时间线` or `布局：三列对比`. Do not include internal implementation notes or API details in the presentation.

For each content slide, choose `visualType` and `layoutIntent` from the message itself: comparison, process, timeline, diagram, data display, or an icon-led list. Use specific Chinese `iconHints` to guide Gamma's native visual mapping. Use `chartSpec` only when the source provides real data, and `diagramSpec` only for supported relationships. The image source selects where Gamma may obtain imagery; it does not assign individual semantic icons. Export verification checks PPTX structure and rendered appearance without inserting local icon images.
