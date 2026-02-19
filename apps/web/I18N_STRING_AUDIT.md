# UI 字串盤點（範圍：components / features / app/[locale]/login）

盤點指令：

```bash
rg -n --glob '!**/__tests__/**' --glob '*.tsx' 'aria-label="[^"]+"|label="[^"]+"|placeholder="[^"]+"' apps/web/components apps/web/features apps/web/app/[locale]/login
```

## 發現硬編碼字串（已完成 i18n 替換）

1. `apps/web/components/BottomNav.tsx`
   - `aria-label="Bottom navigation"`
   - 改為 `nav.bottom.ariaLabel`
2. `apps/web/components/brand/BrandLogo.tsx`
   - `aria-label="Go to scenarios"`
   - 改為 `nav.brand.ariaLabel`
3. `apps/web/features/planLab/PlanLibraryDrawer.tsx`
   - `aria-label="Plan actions"`
   - 改為 `money.planLabPlanActionsAriaLabel`
4. `apps/web/app/[locale]/login/page.tsx`
   - 標題、描述、Email/Password label、按鈕文案、狀態訊息
   - 改為 `auth.login.*`

## 命名策略

- 可見文本：功能導向 key（例：`auth.login.actions.signIn`）
- 可及性文本：a11y 專用 key（例：`nav.bottom.ariaLabel`）

