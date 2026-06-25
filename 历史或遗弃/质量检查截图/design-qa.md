# v10.95.8 Design QA

- Source visual truth: `/tmp/codex-remote-attachments/019ee04c-a470-7c72-9cf4-28039c6a0bd2/03400767-E0F3-48C0-822C-474D29DDE0F6/1-照片-1.jpg`
- Relevant prior account-menu rendering: `/tmp/shengshi-ui-qa-v10957/mobile-account-menu.png`
- Functional anchor target: `src/components/SceneCards.tsx#features`
- Viewport: mobile 500px reference.
- State: authenticated mobile navigation menu.

## Findings

No actionable P0/P1/P2 visual issue remains.

- Menu hierarchy now starts with 用户中心 and 升级套餐, followed by 功能特性.
- The duplicated 定价方案 row is removed.
- The credit card remains unchanged in size, hierarchy and visual prominence.
- Existing icon scale, spacing, glass surface and logout separation are preserved.
- The feature anchor now targets an element that is present on the actual homepage, with sticky-header offset.

## Data integrity verification

- Administrator user credits come from the `users.credits` database field.
- Gamma key-pool tracking no longer overwrites session or account credits.
- Session refreshes trusted user credits from the database.
- Admin adjustments use an optimistic balance condition to prevent concurrent overwrite.
- Negative adjustments are rejected when they would create a negative balance.

## Residual test gap

- Gamma does not expose a true balance endpoint. Its key-pool estimate remains available only as internal monitoring data and is no longer presented as the administrator's spendable user balance.

final result: passed
