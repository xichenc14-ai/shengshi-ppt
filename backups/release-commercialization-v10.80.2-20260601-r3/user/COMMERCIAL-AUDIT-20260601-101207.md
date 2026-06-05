# 商业化上线审计报告

- 时间: 2026-06-01T02:12:07.332Z
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
- [x] test (exit=0)
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


 Test Files  15 passed (15)
      Tests  122 passed | 1 skipped | 33 todo (156)
   Start at  10:12:10
   Duration  373ms (transform 589ms, setup 562ms, import 821ms, tests 149ms, environment 1ms)
```

## build 输出（截断）
```text
▲ Next.js 16.2.2 (Turbopack)
- Environments: .env.production.local

  Creating an optimized production build ...


-----
[1m[31mFATAL[39m[0m: An unexpected Turbopack error occurred. A panic log has been written to /var/folders/9p/kl_7vg8n6fjctr_qyzj534r00000gn/T/next-panic-b390b58efdca5994967b2d9e0d8aa3fc.log.

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
