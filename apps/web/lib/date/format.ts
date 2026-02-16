const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatIsoYmdHms = (dateOrIso: Date | string | number | null | undefined) => {
  if (!dateOrIso) {
    return "";
  }

  const value = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())} ${pad2(
    value.getUTCHours()
  )}:${pad2(value.getUTCMinutes())}:${pad2(value.getUTCSeconds())}`;
};
