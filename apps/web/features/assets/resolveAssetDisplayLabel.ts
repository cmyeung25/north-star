import type { ScenarioAsset } from "../../src/store/scenarioStore";

type AssetDisplayLabelTranslator = (key: "assetTypeCash" | "assetUntitled") => string;

export const resolveAssetDisplayLabel = (
  asset: Pick<ScenarioAsset, "kind" | "label">,
  t: AssetDisplayLabelTranslator
): string => {
  const label = asset.label?.trim();
  if (label) {
    return label;
  }
  if (asset.kind === "cash") {
    return t("assetTypeCash");
  }
  return t("assetUntitled");
};
