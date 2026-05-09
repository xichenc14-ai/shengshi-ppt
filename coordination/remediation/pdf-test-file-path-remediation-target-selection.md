# PDF Test File Path Remediation - Target Selection

> **Stage:** R1
> **Batch:** V2_0_SHENGXIN_PPT_PDF_TEST_FILE_PATH_REMEDIATION_NO_RUNNER
> **Date:** 2026-05-06T22:20:00+08:00

---

## Problem Statement

| Item | Value |
|------|-------|
| Current Test File | `src/app/api/parse-file/route.test.ts` |
| Vitest Include Pattern | `__tests__/**/*.test.ts` |
| Path Match | ❌ DOES NOT MATCH |
| Consequence | Test file not discovered by Vitest |

---

## Target Path Options

| Option | Target Path | Matches Pattern | Risk |
|--------|-------------|-----------------|------|
| A | `__tests__/app/api/parse-file/route.test.ts` | ✅ YES | LOW |
| B | `__tests__/parse-file/route.test.ts` | ✅ YES | LOW |
| C | `__tests__/parse-file.test.ts` | ✅ YES | LOW |

---

## Recommended Target Path

**Option A:** `__tests__/app/api/parse-file/route.test.ts`

### Rationale

1. **Preserves original structure** — Mirrors `src/app/api/parse-file/` in test directory
2. **Easy to locate** — Test file for `src/app/api/parse-file/route.ts` is at `__tests__/app/api/parse-file/route.test.ts`
3. **Consistent with project conventions** — Follows established test placement pattern
4. **Minimum disruption** — Only adds new file, does not modify existing

---

## Alternative Consideration

**Option B:** `__tests__/parse-file/route.test.ts`

### Rationale

1. **Simpler structure** — Flattens the test directory
2. **Easier imports** — Shorter relative paths if imports needed
3. **Trade-off** — Loses the `src/` directory mirroring

---

## Decision

**Select Option A:** `__tests__/app/api/parse-file/route.test.ts`

### Implementation

1. Read current test file content from `src/app/api/parse-file/route.test.ts`
2. Write content to `__tests__/app/api/parse-file/route.test.ts`
3. Verify new file exists and matches pattern
4. Keep original file in place (no deletion, no modification)

### Verification

| Check | Method |
|-------|--------|
| File exists at new path | read tool |
| Path matches include pattern | Static check: `__tests__/**/*.test.ts` |
| Content unchanged | Compare with original |
| No production code modified | No changes to `src/app/api/parse-file/route.ts` |

---

## Constraints Maintained

```
TEST_ONLY_REMEDIATION=YES ✅
NO_RUNNER_EXECUTION=YES ✅
NO_TEST_EXECUTION=YES ✅
NO_PRODUCTION_MODIFICATION=YES ✅
NO_CONFIG_MODIFICATION=YES ✅
NO_PACKAGE_MODIFICATION=YES ✅
```

---

**End of Target Selection**