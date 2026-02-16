const DEFAULT_LOCALE = "zh-HK";
const DEFAULT_TIME_ZONE = "Asia/Hong_Kong";

const formatterOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: DEFAULT_TIME_ZONE,
};

export const formatDateTime = (
  dateOrIso: Date | string | number | null | undefined,
  locale: string = DEFAULT_LOCALE,
) => {
  if (!dateOrIso) {
    return "";
  }

  const value = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, formatterOptions).format(value);
};
