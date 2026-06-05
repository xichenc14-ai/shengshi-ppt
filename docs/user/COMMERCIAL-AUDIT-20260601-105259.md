# 商业化上线审计报告

- 时间: 2026-06-01T02:52:59.678Z
- 版本: 10.80.2
- 结论: **FAIL**

## 环境检查
- [x] NEXT_PUBLIC_SUPABASE_URL - present
- [x] SUPABASE_SERVICE_ROLE_KEY - present
- [x] SESSION_PASSWORD - present
- [ ] PAYMENT_NOTIFY_URL - missing
- [ ] PAYMENT_NOTIFY_SECRET - missing
- [ ] PAYMENT_NOTIFY_URL_HTTPS - missing
- [ ] WECHAT_PROVIDER_READY - missing: WECHAT_PAY_MCH_ID, WECHAT_PAY_APP_ID, WECHAT_PAY_API_V3_KEY
- [ ] ALIPAY_PROVIDER_READY - missing: ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY

## 质量门禁
- [x] lint (exit=0)
- [x] test (exit=0)
- [x] build (exit=1, waived=sandbox-build-port)
- [ ] preflight (exit=1)

## lint 输出（截断）
```text
/Users/macmini/shengshi-ppt/src/components/ChartEditor/index.tsx
  35:9  warning  The 'palette' logical expression could make the dependencies of useCallback Hook (at line 55) change on every render. To fix this, wrap the initialization of 'palette' in its own useMemo() Hook  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/GraphEditor/MermaidFlow.tsx
  81:6  warning  React Hook useEffect has a missing dependency: 'nodes.length'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/StreamingOutline.tsx
  61:6  warning  React Hook useEffect has a missing dependency: 'stage'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/generate/GenerationContext.tsx
  274:6  warning  React Hook useCallback has a missing dependency: 'openLogin'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/macmini/shengshi-ppt/src/components/p3-chart/export/pdfExporter.tsx
  123:61  warning  '_exportConfig' is defined but never used  @typescript-eslint/no-unused-vars
  128:61  warning  '_exportConfig' is defined but never used  @typescript-eslint/no-unused-vars
  133:65  warning  '_exportConfig' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/p3-chart/renderers/GraphRenderer.tsx
  83:17  warning  'setNodes' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/p3-charts/charts/components/PieChart.tsx
   93:7  warning  'renderActiveShape' is assigned a value but never used  @typescript-eslint/no-unused-vars
  152:9  warning  'activeIndex' is assigned a value but never used        @typescript-eslint/no-unused-vars
  154:9  warning  'handleMouseEnter' is assigned a value but never used   @typescript-eslint/no-unused-vars
  160:9  warning  'handleMouseLeave' is assigned a value but never used   @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/components/p3-charts/charts/renderers/svgRenderer.ts
    8:10  warning  'buildChartStyle' is defined but never used     @typescript-eslint/no-unused-vars
    8:27  warning  'buildGridConfig' is defined but never used     @typescript-eslint/no-unused-vars
    8:44  warning  'buildAxisConfig' is defined but never used     @typescript-eslint/no-unused-vars
    8:61  warning  'buildTooltipConfig' is defined but never used  @typescript-eslint/no-unused-vars
    8:81  warning  'getChartColors' is defined but never used      @typescript-eslint/no-unused-vars
  182:7   warning  'options' is assigned a value but never used    @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/lib/adapters/ppt-param-adapter.ts
  149:3  warning  '_themeId' is defined but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/lib/build-md-v2.ts
   36:10  warning  'buildCoverPage' is defined but never used             @typescript-eslint/no-unused-vars
   41:10  warning  'buildEndingPage' is defined but never used            @typescript-eslint/no-unused-vars
  153:3   warning  'allowEnhancement' is assigned a value but never used  @typescript-eslint/no-unused-vars
  221:3   warning  'scene' is assigned a value but never used             @typescript-eslint/no-unused-vars
  223:3   warning  '_visualMetaphor' is defined but never used            @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/lib/chart-engine.ts
  98:3  warning  '_scale' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/lib/graph/mermaid-converter.ts
  92:11  warning  'shape' is assigned a value but never used  @typescript-eslint/no-unused-vars

/Users/macmini/shengshi-ppt/src/lib/theme-database.ts
  652:3  warning  Unused eslint-disable directive (no problems were reported from 'no-console')

/Users/macmini/shengshi-ppt/src/lib/theme/palette-generator.ts
    6:40  warning  'adjustLightness' is defined but never used     @typescript-eslint/no-unused-vars
    6:57  warning  'adjustSaturation' is defined but never used    @typescript-eslint/no-unused-vars
   98:72  warning  'background' is defined but never used          @typescript-eslint/no-unused-vars
  100:9   warning  'accentHsl' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 31 problems (0 errors, 31 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

## test 输出（截断）
```text
RUN  v4.1.5 /Users/macmini/shengshi-ppt


 Test Files  15 passed (15)
      Tests  122 passed | 1 skipped | 33 todo (156)
   Start at  10:53:03
   Duration  371ms (transform 621ms, setup 532ms, import 896ms, tests 138ms, environment 1ms)
```

## build 输出（截断）
```text
▲ Next.js 16.2.2 (Turbopack)
- Environments: .env.production.local

  Creating an optimized production build ...


-----
[1m[31mFATAL[39m[0m: An unexpected Turbopack error occurred. A panic log has been written to /var/folders/9p/kl_7vg8n6fjctr_qyzj534r00000gn/T/next-panic-6b14d36e95377fa7dac7f08e435ccef7.log.

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
