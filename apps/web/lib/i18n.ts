export const locale = "zh-HK";
export const defaultCurrency = "HKD";

const translations = {
  "zh-HK": {
    appName: "北極星",
    appDescription: "以行動裝置為主的 PWA 人生階段理財規劃。",
    navHome: "首頁",
    navOverview: "總覽",
    navScenarios: "情境",
    navTimeline: "時間線",
    navStress: "壓力測試",
    homeTitle: "規劃你的下一個人生階段",
    homeIntro:
      "歡迎來到北極星。你的個人化人生階段規劃將在此展開。",
    homeCta: "開始探索",
    scenariosTitle: "情境",
    scenariosSubtitle: "選擇計劃以比較人生決策。",
    scenariosYourScenarios: "你的情境",
    scenariosNewScenario: "+ 新增情境",
    scenariosUpdated: "更新於 {time}",
    scenariosActive: "目前使用",
    scenariosSetActive: "設為使用中",
    scenariosGoToTimeline: "前往時間線",
    scenariosRename: "重新命名",
    scenariosDuplicate: "複製",
    scenariosDelete: "刪除",
    scenariosActiveUpdated: "已更新使用中的情境",
    scenariosCreated: "已建立情境",
    scenariosRenamed: "已重新命名情境",
    scenariosDuplicated: "已複製情境",
    scenariosDeleteMinimum: "至少需保留一個情境。",
    scenariosActiveSwitched: "已切換使用中的情境至 {name}。",
    scenariosDeleted: "已刪除情境",
    scenariosCopyOf: "複製 {name}",
    scenariosActionsAria: "{name} 的操作",
    scenariosNewTitle: "新增情境",
    scenariosRenameTitle: "重新命名情境",
    scenariosDeleteTitle: "刪除情境",
    scenariosNameLabel: "情境名稱",
    scenariosNamePlaceholder: "例如：方案 D · 休假",
    scenariosCancel: "取消",
    scenariosCreate: "建立",
    scenariosSave: "儲存",
    scenariosConfirmDelete: "確定要刪除 {name} 嗎？",
    scenariosLowestBalance: "最低結餘",
    scenariosRunway: "可支撐月數",
    scenariosNetWorth5y: "5 年後淨值",
    scenariosMonthsSuffix: "個月",
    scenariosRisk: "風險",
    scenariosBaseCurrency: "基本貨幣",
    riskLow: "低",
    riskMedium: "中",
    riskHigh: "高",
    timeToday: "今天",
    timeDaysAgo: "{count} 天前",
    timeWeeksAgo: "{count} 週前",
    timelineTitle: "時間線",
    timelineSubtitleDesktop: "以表格檢視事件並在側邊欄編輯。",
    timelineSubtitleMobile: "追蹤影響計劃的人生事件。",
    timelineAddEvent: "+ 新增事件",
    timelineTableEnabled: "啟用",
    timelineTableType: "類型",
    timelineTableName: "名稱",
    timelineTableStart: "開始",
    timelineTableEnd: "結束",
    timelineTableMonthly: "每月",
    timelineTableOneTime: "一次性",
    timelineTableGrowth: "增長",
    timelineTableCurrency: "貨幣",
    timelineTableActions: "操作",
    timelineEdit: "編輯",
    timelineChooseTemplate: "選擇範本",
    timelineEditTitle: "編輯 {type}",
    timelineNoAmounts: "尚無金額",
    timelineMonthlyLabel: "每月",
    timelineOneTimeLabel: "一次性",
    timelineSaveChanges: "儲存變更",
    timelineDuplicateAria: "複製 {name}",
    timelineDeleteAria: "刪除 {name}",
    timelineCopyName: "{name}（副本）",
    timelineEventPlan: "{label} 計劃",
    timelineOngoing: "持續中",
    eventFormName: "名稱",
    eventFormStartMonth: "開始月份",
    eventFormStartMonthPlaceholder: "YYYY-MM",
    eventFormEndMonth: "結束月份",
    eventFormEndMonthPlaceholder: "YYYY-MM（選填）",
    eventFormMonthlyAmount: "每月金額",
    eventFormOneTimeAmount: "一次性金額",
    eventFormAnnualGrowth: "年度增長 %",
    eventFormCurrency: "貨幣",
    eventFormEnabled: "啟用",
    eventFormCancel: "取消",
    eventFormSave: "儲存",
    currencyHkdLabel: "港幣 (HKD)",
    eventTypeRent: "租屋",
    eventTypeBuyHome: "買樓",
    eventTypeBaby: "寶寶",
    eventTypeCar: "車",
    eventTypeTravel: "旅遊",
    eventTypeInsurance: "保險",
    eventTypeHelper: "家傭",
    eventTypeCustom: "自訂",
  },
} as const;

export type TranslationKey = keyof (typeof translations)[typeof locale];

type InterpolationValues = Record<string, string | number>;

export const t = (
  key: TranslationKey,
  values?: InterpolationValues
): string => {
  const text = translations[locale][key] as string;

  if (!values) {
    return text;
  }

  return Object.entries(values).reduce<string>(
    (current, [token, value]) =>
      current.replace(new RegExp(`\\{${token}\\}`, "g"), String(value)),
    text
  );
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export const formatCurrency = (amount: number, currency = defaultCurrency) => {
  if (!currencyFormatters.has(currency)) {
    currencyFormatters.set(
      currency,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      })
    );
  }

  return currencyFormatters.get(currency)?.format(amount) ?? `${amount} ${currency}`;
};
