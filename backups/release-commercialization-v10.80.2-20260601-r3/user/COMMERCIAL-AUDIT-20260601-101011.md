# 商业化上线审计报告

- 时间: 2026-06-01T02:10:11.326Z
- 版本: 10.80.2
- 结论: **FAIL**

## 环境检查
- [x] NEXT_PUBLIC_SUPABASE_URL - present
- [x] SUPABASE_SERVICE_ROLE_KEY - present
- [ ] PAYMENT_NOTIFY_URL - missing
- [ ] PAYMENT_NOTIFY_URL_HTTPS - missing
- [ ] WECHAT_PROVIDER_READY - missing: WECHAT_PAY_MCH_ID, WECHAT_PAY_APP_ID, WECHAT_PAY_API_V3_KEY
- [ ] ALIPAY_PROVIDER_READY - missing: ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY

## 质量门禁
- [x] lint (exit=0)
- [ ] test (exit=1)
- [ ] build (exit=1)
- [ ] preflight (exit=1)

## lint 输出（截断）
```text
/Users/macmini/shengshi-ppt/src/app/admin/page.tsx
  150:6  warning  React Hook React.useCallback has an unnecessary dependency: 'user?.is_admin'. Either exclude it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/app/api/account/overview/route.ts
  38:27  warning  '_request' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/diagnostic/route.ts
  15:28  warning  'request' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/gamma/route.ts
  378:7  warning  'numCards' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/pay-once/route.ts
  20:11  warning  'total' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/ppt-local/route.ts
  70:16  warning  'e' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/user/route.ts
  307:16  warning  'e' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/api/wechat/callback/route.ts
  11:9  warning  'state' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/app/page.tsx
    21:8  warning  'SkeletonCard' is defined but never used                                                                                     @typescript-eslint/no-unused-vars
   385:9  warning  'router' is assigned a value but never used                                                                                  @typescript-eslint/no-unused-vars
   654:9  warning  'startGenerate' is assigned a value but never used                                                                           @typescript-eslint/no-unused-vars
   988:6  warning  React Hook useCallback has a missing dependency: 'openLogin'. Either include it or remove the dependency array               react-hooks/exhaustive-deps
  1337:6  warning  React Hook useCallback has a missing dependency: 'result.renderSignature'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/ChartEditor/index.tsx
  35:9  warning  The 'palette' logical expression could make the dependencies of useCallback Hook (at line 55) change on every render. To fix this, wrap the initialization of 'palette' in its own useMemo() Hook  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/GraphEditor/MermaidFlow.tsx
  81:6  warning  React Hook useEffect has a missing dependency: 'nodes.length'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/GraphEditor/NodePalette.tsx
  104:42  warning  'themeColor' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/GraphEditor/nodes/CylinderNode.tsx
  14:43  warning  'selected' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/HeroInput.tsx
  34:3   warning  'hasInput' is defined but never used        @typescript-eslint/no-unused-vars
  35:3   warning  'directTheme' is defined but never used     @typescript-eslint/no-unused-vars
  35:16  warning  'setDirectTheme' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/HeroSection.tsx
  21:10  warning  'selectedScene' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/LoginModal.tsx
   31:10  warning  'codeSent' is assigned a value but never used           @typescript-eslint/no-unused-vars
  136:9   warning  'handleCodeInput' is assigned a value but never used    @typescript-eslint/no-unused-vars
  152:9   warning  'handleCodeKeyDown' is assigned a value but never used  @typescript-eslint/no-unused-vars
  158:9   warning  'handleCodePaste' is assigned a value but never used    @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/ProPanel.tsx
   3:17  warning  'useState' is defined but never used                                                                                                                                                                                                 @typescript-eslint/no-unused-vars
  61:6   warning  React Hook React.useEffect has a missing dependency: 'onClose'. Either include it or remove the dependency array. If 'onClose' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/ScrollingBanner.tsx
  3:38  warning  'useCallback' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/StreamingOutline.tsx
  61:6  warning  React Hook useEffect has a missing dependency: 'stage'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/ThemeManager/BrandColorImport.tsx
   10:10  warning  'ThemePalette' is defined but never used                                                                                                                                                                                                                                                 @typescript-eslint/no-unused-vars
  112:11  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/macmini/shengshi-ppt/src/components/ThemeManager/GradientPicker.tsx
  38:9  warning  'suggestedTo' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/
```

## test 输出（截断）
```text
RUN  v4.1.5 /Users/macmini/shengshi-ppt

stdout | __tests__/api/gamma.test.ts > Gamma API 真实端到端测试 > 完整链路：生成3页PPT → 轮询完成 → 下载验证
[Gamma] IMAGE_SOURCE_MAP preview= {"requested":"auto","mappedSource":"themeAccent","auto":false}
[Gamma] 使用Key: key1 | 余额: 1000
[Gamma] textMode: preserve (fixed) | imageOptions: {"source":"themeAccent"} | imageMode: auto
[Gamma] FULL PAYLOAD: {"inputText":"# # AI技术趋势报告\n\n## 机器学习\n\n- 监督学习\n- 无监督学习\n- 强化学习\n\n---\n\n\n---\n","textMode":"preserve","format":"presentation","exportAs":"pptx","themeId":"consultant","additionalInstructions":"【排版规则 - 严格遵守】\n\n📐 字号规范(必须精确):\n- 主标题(#):≥ 44pt,加粗,居中\n- 页面标题(##):≥ 32pt,加粗\n- 大文本要点(###):≥ 24pt,加粗(正文必须是大文本,禁止小字)\n- 卡片标题(- **标题**):≥ 20pt,加粗\n\n📝 内容密度(铁律):\n- 单页正文严格控制在50-80字以内\n- 超出80字必须拆分到下一页\n- 禁止出现大段文本堆积\n- 每页只放3-4个核心要点\n- 神奇数字3与4:归纳为3或4个并列项,触发三列/四宫格布局\n\n🎨 布局触发规则(核心技巧):\n- 3-4个并列要点 → 使用三列/四宫格卡片布局\n- 有序列表(1. 2. 3.)→ 时间轴/流程布局\n- ### 大文本短句 → 独占一行的大字正文(非普通小字)\n- **粗体短句** → 视觉强调(放大显示)\n- 对比内容(### 优势 / ### 劣势)→ 左右对照布局\n\n📊 数据可视化(铁律):\n- 提到数据/统计/比例时必须分配图表类型(折线图/柱状图/饼图/散点图)\n- 趋势变化 → 折线图 📈\n- 数量比较 → 柱状图 📊\n- 占比份额 → 饼图/环形图 🥧\n- 关系分布 → 散点图 🔵\n- 所有图表必须显示数据标签\n- 图表标题清晰，说明数据来源\n\n📌 禁止事项(绝对禁止):\n- 禁止普通小字正文(必须是大文本)\n- 禁止将列表排成表格\n- 禁止表格嵌套超过2层\n- 禁止在内容页堆砌超过4个要点\n\n【风格:专业商务】\n配色:克制优雅,主色(深蓝/深灰)+ 1个强调色(金色/橙色),大面积留白\n字体:无衬线字体(思源黑体/PingFang SC/Microsoft YaHei)\n布局:规整对称,信息密度适中,视觉层次清晰\n感觉:麦肯锡/BCG/贝恩咨询PPT风格,权威可信\n\n【图标规则】(图标是PPT视觉丰富度的核心,必须使用)\n- 每一页都必须包含2-5个 Icons 图标,用于标记要点和装饰\n- 图标风格:Simple, outlined, consistent stroke width, professional\n- 图标颜色:与主色调保持一致\n- 禁止出现没有任何图标的页面(即使是纯文字页也必须加装饰性图标)\n- 推荐图标库:Font Awesome, Material Icons, Ionicons\n\n【配图规则】(主题套图=themeAccent主题强调图,精选网图=webFreeToUseCommercially)\n- 严格遵循 imageOptions.source（themeAccent / webFreeToUseCommercially / aiGenerated）\n- source=themeAccent 时，优先主题强调图；如无法出图，改为纯文字+图标布局，不得保留空白图片框\n- source=web/ai 时，优先对应来源配图；若取图失败可回退主题图或无图文本布局\n- 禁止固定“右侧图片槽位”而没有实际图片内容\n\n【语言规则】\n- 所有文字使用简体中文\n- 保持演讲者备注(通过 > 引用块)\n\n【图标规范-统一风格】\n使用Gamma内置的图标系统(Icons),保持风格统一:简洁、线性、单色、与主题色一致。禁止混用不同风格的图标(不要同时使用emoji和线性图标)。每页2-4个图标,用于要点标记和视觉装饰。禁止出现无图标的页面。\n\n【图片策略-强制】\n1. 封面页、目录页、章节过渡页、结束页：优先配图，但若图片不可用必须改为无图文本布局，禁止空白图片容器。结构页优先使用主题强调图（themeAccent / Emphasize布局）；若主题图不可用，改为纯文字+图标布局。\n2. 内容页不强制每页配图；若配图失败，必须删除图片容器并改用图标+色块排版，禁止灰色占位框。\n3. 内容页需按主题语义补足可见主图，必要时可使用 web/ai 获取更贴题图片，失败时回退 themeAccent。\n4. 当来源为 web/ai 时，内容页一旦配图必须使用对应来源，不得偷偷替换为其它来源。\n5. 当来源为 web/ai 时，内容页中至少 70% 

 ❯ __tests__/api/gamma.test.ts (4 tests | 1 failed) 35ms
     × 完整链路：生成3页PPT → 轮询完成 → 下载验证 32ms

 Test Files  1 failed | 14 passed (15)
      Tests  1 failed | 122 passed | 33 todo (156)
   Start at  10:10:15
   Duration  393ms (transform 644ms, setup 560ms, import 911ms, tests 199ms, environment 1ms)


stderr | __tests__/api/gamma.test.ts > Gamma API 真实端到端测试 > 完整链路：生成3页PPT → 轮询完成 → 下载验证
Gamma generation error: fetch failed


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  __tests__/api/gamma.test.ts > Gamma API 真实端到端测试 > 完整链路：生成3页PPT → 轮询完成 → 下载验证
AssertionError: expected 500 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 500

 ❯ __tests__/api/gamma.test.ts:106:28
    104|     }));
    105|
    106|     expect(postRes.status).toBe(200);
       |                            ^
    107|     const postData = await postRes.json() as Record<string, unknown>;
    108|     const generationId = getStringField(postData, 'generationId');

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## build 输出（截断）
```text
▲ Next.js 16.2.2 (Turbopack)
- Environments: .env.production.local

  Creating an optimized production build ...


-----
[1m[31mFATAL[39m[0m: An unexpected Turbopack error occurred. A panic log has been written to /var/folders/9p/kl_7vg8n6fjctr_qyzj534r00000gn/T/next-panic-404c9ba299d32fdb8bc863c56ae61a3d.log.

To help make Turbopack better, report this error by clicking here: https://bugs.nextjs.org/search?category=turbopack-error-report&title=Turbopack%20Error%3A%20Failed%20to%20write%20app%20endpoint%20%2Fpage&body=Turbopack%20version%3A%20%608d0f77bfa%60%0ANext.js%20version%3A%20%600.0.0%60%0A%0AError%20message%3A%0A%60%60%60%0AFailed%20to%20write%20app%20endpoint%20%2Fpage%0A%0ACaused%20by%3A%0A-%20%5Bproject%5D%2Fsrc%2Fapp%2Fglobals.css%20%5Bapp-client%5D%20%28css%29%0A-%20creating%20new%20process%0A-%20binding%20to%20a%20port%0A-%20Operation%20not%20permitted%20%28os%20error%201%29%0A%0ADebug%20info%3A%0A-%20Execution%20of%20get_all_written_entrypoints_with_issues_operation%20failed%0A-%20Execution%20of%20EntrypointsOperation%3A%3Anew%20failed%0A-%20Execution%20of%20all_entrypoints_write_to_disk_operation%20failed%0A-%20Execution%20of%20output_assets_operation%20failed%0A-%20Execution%20of%20%3CAppEndpoint%20as%20Endpoint%3E%3A%3Aoutput%20failed%0A-%20Failed%20to%20write%20app%20endpoint%20%2Fpage%0A-%20Execution%20of%20AppEndpoint%3A%3Aoutput%20failed%0A-%20Execution%20of%20whole_app_module_graph_operation%20failed%0A-%20Execution%20of%20%2AProject%3A%3Aget_all_additional_entries%20failed%0A-%20Execution%20of%20ModuleGraph%3A%3Afrom_single_graph_without_unused_references%20failed%0A-%20Execution%20of%20ModuleGraph%3A%3Acreate%20failed%0A-%20Execution%20of%20SingleModuleGraph%3A%3Anew_with_entries%20failed%0A-%20%5Bproject%5D%2Fsrc%2Fapp%2Fglobals.css%20%5Bapp-client%5D%20%28css%29%0A-%20Execution%20of%20primary_chunkable_referenced_modules%20failed%0A-%20Execution%20of%20%3CCssModule%20as%20Module%3E%3A%3Areferences%20failed%0A-%20Execution%20of%20parse_css%20failed%0A-%20Execution%20of%20%3CPostCssTransformedAsset%20as%20Asset%3E%3A%3Acontent%20failed%0A-%20Execution%20of%20PostCssTransformedAsset%3A%3Aprocess%20failed%0A-%20Execution%20of%20evaluate_webpack_loader%20failed%0A-%20creating%20new%20process%0A-%20binding%20to%20a%20port%0A-%20Operation%20not%20permitted%20%28os%20error%201%29%0A%60%60%60&labels=Turbopack,Turbopack%20Panic%20Backtrace
-----


> Build error occurred
Error [TurbopackInternalError]: Failed to write app endpoint /page

Caused by:
- [project]/src/app/globals.css [app-client] (css)
- creating new process
- binding to a port
- Operation not permitted (os error 1)

Debug info:
- Execution of get_all_written_entrypoints_with_issues_operation failed
- Execution of EntrypointsOperation::new failed
- Execution of all_entrypoints_write_to_disk_operation failed
- Execution of output_assets_operation failed
- Execution of <AppEndpoint as Endpoint>::output failed
- Failed to write app endpoint /page
- Execution of AppEndpoint::output failed
- Execution of whole_app_module_graph_operation failed
- Execution of *Project::get_all_additional_entries failed
- Execution of ModuleGraph::from_single_graph_without_unused_references failed
- Execution of ModuleGraph::create failed
- Execution of SingleModuleGraph::new_with_entries failed
- [project]/src/app/globals.css [app-client] (css)
- Execution of primary_chunkable_referenced_modules failed
- Execution of <CssModule as Module>::references failed
- Execution of parse_css failed
- Execution of <PostCssTransformedAsset as Asset>::content failed
- Execution of PostCssTransformedAsset::process failed
- Execution of evaluate_webpack_loader failed
- creating new process
- binding to a port
- Operation not permitted (os error 1)
    at <unknown> (TurbopackInternalError: Failed to write app endpoint /page) {
  type: 'TurbopackInternalError',
  location: undefined
}
```

## preflight 输出（截断）
```text
[preflight] FAIL: 缺少环境变量 PAYMENT_NOTIFY_URL
```
