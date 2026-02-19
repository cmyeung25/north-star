# Web UI i18n Code Review Checklist

適用範圍：`apps/web/**/*.tsx`（測試檔除外）。

- [ ] 不直接新增硬編碼可見字串（按鈕、標題、表單標籤、說明文、placeholder）。
- [ ] 不直接新增硬編碼可及性字串（`aria-label`、`title`、`aria-describedby` 等）。
- [ ] 可見字串與 a11y 字串使用不同 key 命名（例如 `nav.bottom.ariaLabel` vs `nav.bottom.home`）。
- [ ] 新增或修改字串時，同步更新 `apps/web/messages/en.json`、`apps/web/messages/zh-HK.json`、`apps/web/messages/zh-Hant-HK.json`。
- [ ] 若為可切換 locale 的畫面，切換語系後確認可見文案與 a11y 文案皆同步變更。

建議搭配搜尋檢查：

```bash
rg -n --glob '!**/__tests__/**' --glob '*.tsx' 'aria-label="[^"]+"|label="[^"]+"|placeholder="[^"]+"'
```
