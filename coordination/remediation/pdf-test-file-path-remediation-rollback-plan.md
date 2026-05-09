# PDF Test File Path Remediation - Rollback Plan

> **Stage:** R2
> **Batch:** V2_0_SHENGXIN_PPT_PDF_TEST_FILE_PATH_REMEDIATION_NO_RUNNER
> **Date:** 2026-05-06T22:20:00+08:00

---

## Rollback Scope

| Item | Value |
|------|-------|
| Files Created | 1 |
| Files Modified | 0 |
| Files Deleted | 0 |
| Rollback Complexity | VERY LOW |

---

## Rollback Procedure

### Step 1: Remove New Test File

```
DELETE: __tests__/app/api/parse-file/route.test.ts
```

**Note:** If you used `write` tool to create the file, simply do not use the new path.
The original test file at `src/app/api/parse-file/route.test.ts` remains untouched.

### Step 2: Verify Restoration

| Check | Method |
|-------|--------|
| New file removed | Attempt to read `__tests__/app/api/parse-file/route.test.ts` |
| Original file intact | Verify `src/app/api/parse-file/route.test.ts` exists |

### Step 3: Cleanup Empty Directories

If `__tests__/app/api/parse-file/` becomes empty after rollback:

```
rmdir __tests__/app/api/parse-file/
rmdir __tests__/app/api/  (if empty)
rmdir __tests__/app/      (if empty)
```

---

## Rollback Commands (If Exec Were Authorized)

| Command | Action |
|---------|--------|
| `rm __tests__/app/api/parse-file/route.test.ts` | Remove new file |
| `rmdir __tests__/app/api/parse-file/` | Remove empty dir |
| `git checkout src/app/api/parse-file/route.test.ts` | Restore from git (if needed) |

**Note:** These commands are for documentation only. Not executed due to exec=deny.

---

## Rollback Scenarios

### Scenario A: User Wants Original State Only

**Action:** Do not use the new test file path
**Result:** Original test file at `src/app/api/parse-file/route.test.ts` remains discoverable if user later runs tests from that location

### Scenario B: User Wants Complete Removal

**Action:** Delete the new file at `__tests__/app/api/parse-file/route.test.ts`
**Result:** Project returns to pre-remediation state

### Scenario C: User Wants Both Files

**Action:** Keep both files
**Result:** Two copies of similar test skeleton exist

---

## Rollback Verification Checklist

| Check | Pass Criteria |
|-------|---------------|
| New file removed | `__tests__/app/api/parse-file/route.test.ts` does not exist |
| Original file intact | `src/app/api/parse-file/route.test.ts` exists |
| No config changes | `vitest.config.ts` unchanged |
| No production changes | `src/app/api/parse-file/route.ts` unchanged |

---

## Rollback Confirmation

To rollback this remediation:

```
DELETE FILE: __tests__/app/api/parse-file/route.test.ts
```

No other files were modified. Rollback is safe and contained.

---

**End of Rollback Plan**