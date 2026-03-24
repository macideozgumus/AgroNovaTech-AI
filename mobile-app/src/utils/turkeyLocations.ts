import rawLocations from "./turkey-provinces-districts.json";

type RawDistrict = {
  id: number;
  name: string;
};

type RawProvince = {
  id: number;
  name: string;
  districts: RawDistrict[];
};

export type TurkeyDistrict = {
  id: number;
  name: string;
};

export type TurkeyProvince = {
  id: number;
  name: string;
  districts: TurkeyDistrict[];
};

const brokenChars: [string, string][] = [
  ["Ã„Â", "Ğ"],
  ["Ã„Â°", "İ"],
  ["Ã„Â±", "ı"],
  ["Ã…Â", "Ş"],
  ["Ã…ÂŸ", "ş"],
  ["ÃƒÂ‡", "Ç"],
  ["ÃƒÂ§", "ç"],
  ["ÃƒÂ–", "Ö"],
  ["ÃƒÂ¶", "ö"],
  ["ÃƒÂœ", "Ü"],
  ["ÃƒÂ¼", "ü"],
];

function fixText(value: string) {
  return brokenChars.reduce((current, [broken, correct]) => current.split(broken).join(correct), value);
}

function toTurkishTitleCase(value: string) {
  return fixText(value)
    .toLocaleLowerCase("tr-TR")
    .split(/(\s|-)/)
    .map((part) => {
      if (part === " " || part === "-") {
        return part;
      }
      const [first, ...rest] = part;
      return first ? `${first.toLocaleUpperCase("tr-TR")}${rest.join("")}` : part;
    })
    .join("");
}

export function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export const turkeyProvinces: TurkeyProvince[] = (rawLocations as RawProvince[]).map((province) => ({
  id: province.id,
  name: toTurkishTitleCase(province.name),
  districts: province.districts.map((district) => ({
    id: district.id,
    name: toTurkishTitleCase(district.name),
  })),
}));

export function buildVillageOptions(province: string, district: string) {
  const districtCore = district.replace(/ İlçesi$/i, "");
  return [
    `${districtCore} Merkez Köyü`,
    `${districtCore} Aşağı Köy`,
    `${districtCore} Yukarı Köy`,
    `${province} Tarım Yerleşkesi`,
  ];
}
