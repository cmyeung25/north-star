import { describe, expect, it } from "vitest";
import zhHK from "../../../../messages/zh-HK.json";
import en from "../../../../messages/en.json";

const requiredMoneyKeys = [
  "moneyMetaTypeLabel",
  "moneyMetaKindLabel",
  "moneyMetaFrequencyLabel",
  "moneyMetaBelongsToLabel",
  "moneyMetaDomainLabel",
  "moneyMetaDomainCashflow",
  "moneyMetaDomainHousing",
  "moneyMetaDomainLoan",
  "moneyMetaDomainInsurance",
  "moneyMetaDomainAsset",
  "moneyMetaDomainLiability",
  "inputsRuleTagType",
  "inputsRuleTagLifecycle",
  "inputsEventMetaWithAdjustments",
] as const;

describe("money message keys", () => {
  it("contains MoneyMetaTags generic labels in zh-HK and en locales", () => {
    requiredMoneyKeys.forEach((key) => {
      expect(zhHK.money[key]).not.toBeUndefined();
      expect(en.money[key]).not.toBeUndefined();
    });
  });
});
