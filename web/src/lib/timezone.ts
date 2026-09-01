// Comprehensive timezone utility for real-world event scheduling.
// Uses the browser's Intl API for accurate DST-aware conversions.
// No external deps — works on Vercel + Cloudflare.

export interface TimezoneGroup {
  region: string;
  zones: { id: string; label: string }[];
}

const ZONE_REGIONS: Record<string, string[]> = {
  Africa: [
    "Africa/Johannesburg", "Africa/Lagos", "Africa/Cairo", "Africa/Nairobi",
    "Africa/Casablanca", "Africa/Accra", "Africa/Addis_Ababa", "Africa/Algiers",
    "Africa/Dakar", "Africa/Dar_es_Salaam", "Africa/Harare", "Africa/Kampala",
    "Africa/Khartoum", "Africa/Kigali", "Africa/Kinshasa", "Africa/Luanda",
    "Africa/Lusaka", "Africa/Maputo", "Africa/Monrovia", "Africa/Tripoli",
    "Africa/Tunis", "Africa/Windhoek", "Africa/Abidjan", "Africa/Bangui",
    "Africa/Blantyre", "Africa/Brazzaville", "Africa/Bujumbura", "Africa/Conakry",
    "Africa/Douala", "Africa/Freetown", "Africa/Gaborone", "Africa/Libreville",
    "Africa/Lome", "Africa/Malabo", "Africa/Maseru", "Africa/Mbabane",
    "Africa/Niamey", "Africa/Nouakchott", "Africa/Ouagadougou", "Africa/Porto-Novo",
    "Africa/Sao_Tome", "Africa/Timbuktu", "Africa/Banjul", "Africa/Bissau",
  ],
  America: [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Anchorage", "America/Toronto", "America/Vancouver", "America/Halifax",
    "America/Sao_Paulo", "America/Argentina/Buenos_Aires", "America/Mexico_City",
    "America/Bogota", "America/Lima", "America/Santiago", "America/Caracas",
    "America/Montevideo", "America/Asuncion", "America/Quito", "America/La_Paz",
    "America/Guatemala", "America/Managua", "America/San_Jose", "America/Panama",
    "America/Havana", "America/Kingston", "America/Port-au-Prince", "America/Santo_Domingo",
    "America/Barbados", "America/Port_of_Spain", "America/Nassau", "America/Belize",
    "America/Tegucigalpa", "America/El_Salvador", "America/Martinique", "America/Guadeloupe",
    "America/Cayman", "America/Winnipeg", "America/Edmonton", "America/Regina",
    "America/St_Johns", "America/Whitehorse", "America/Yellowknife", "America/Iqaluit",
    "America/Recife", "America/Fortaleza", "America/Manaus", "America/Belem",
    "America/Campo_Grande", "America/Cuiaba", "America/Salvador", "America/Maceio",
  ],
  Europe: [
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
    "Europe/Rome", "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna",
    "Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki",
    "Europe/Dublin", "Europe/Lisbon", "Europe/Warsaw", "Europe/Prague",
    "Europe/Budapest", "Europe/Zurich", "Europe/Athens", "Europe/Istanbul",
    "Europe/Moscow", "Europe/Bucharest", "Europe/Sofia", "Europe/Belgrade",
    "Europe/Zagreb", "Europe/Ljubljana", "Europe/Sarajevo", "Europe/Skopje",
    "Europe/Tirana", "Europe/Tallinn", "Europe/Riga", "Europe/Vilnius",
    "Europe/Chisinau", "Europe/Kyiv", "Europe/Minsk", "Europe/Luxembourg",
    "Europe/Malta", "Europe/Bratislava", "Europe/Reykjavik", "Europe/Gibraltar",
    "Europe/Monaco", "Europe/San_Marino", "Europe/Vatican", "Europe/Vaduz",
    "Europe/Andorra", "Europe/Uzhgorod", "Europe/Zaporozhye", "Europe/Simferopol",
  ],
  Asia: [
    "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore",
    "Asia/Dubai", "Asia/Seoul", "Asia/Bangkok", "Asia/Jakarta",
    "Asia/Manila", "Asia/Kuala_Lumpur", "Asia/Taipei", "Asia/Ho_Chi_Minh",
    "Asia/Kolkata", "Asia/Karachi", "Asia/Dhaka", "Asia/Tehran",
    "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Baghdad",
    "Asia/Beirut", "Asia/Damascus", "Asia/Amman", "Asia/Jerusalem",
    "Asia/Doha", "Asia/Muscat", "Asia/Bahrain", "Asia/Yerevan",
    "Asia/Baku", "Asia/Tbilisi", "Asia/Almaty", "Asia/Tashkent",
    "Asia/Kathmandu", "Asia/Colombo", "Asia/Yangon", "Asia/Phnom_Penh",
    "Asia/Vientiane", "Asia/Brunei", "Asia/Macau", "Asia/Ulaanbaatar",
    "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Yakutsk", "Asia/Vladivostok",
    "Asia/Magadan", "Asia/Kamchatka", "Asia/Anadyr", "Asia/Omsk",
    "Asia/Yekaterinburg", "Asia/Chita", "Asia/Jayapura", "Asia/Makassar",
    "Asia/Pontianak", "Asia/Seoul", "Asia/Pyongyang", "Asia/Ashgabat",
    "Asia/Dushanbe", "Asia/Bishkek", "Asia/Thimphu", "Asia/Gaza",
    "Asia/Hebron", "Asia/Famagusta", "Asia/Nicosia", "Asia/Oral",
  ],
  "Australia / Pacific": [
    "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth",
    "Australia/Adelaide", "Australia/Hobart", "Australia/Darwin", "Australia/Canberra",
    "Pacific/Auckland", "Pacific/Fiji", "Pacific/Honolulu", "Pacific/Tahiti",
    "Pacific/Guam", "Pacific/Port_Moresby", "Pacific/Noumea", "Pacific/Apia",
    "Pacific/Tongatapu", "Pacific/Majuro", "Pacific/Pago_Pago", "Pacific/Guadalcanal",
    "Pacific/Tarawa", "Pacific/Funafuti", "Pacific/Wallis", "Pacific/Efate",
    "Pacific/Palau", "Pacific/Nauru", "Pacific/Tuvalu", "Pacific/Kwajalein",
    "Pacific/Chatham", "Pacific/Pitcairn", "Pacific/Easter", "Pacific/Galapagos",
    "Pacific/Midway", "Pacific/Kiritimati", "Pacific/Rarotonga", "Pacific/Niue",
    "Pacific/Fakaofo", "Pacific/Bougainville", "Pacific/Chuuk", "Pacific/Pohnpei",
    "Pacific/Kosrae",
  ],
  Antarctica: [
    "Antarctica/South_Pole", "Antarctica/McMurdo", "Antarctica/Palmer",
    "Antarctica/Rothera", "Antarctica/Syowa", "Antarctica/Mawson",
    "Antarctica/Davis", "Antarctica/Casey", "Antarctica/DumontDUrville",
    "Antarctica/Vostok", "Antarctica/Troll",
  ],
};

function zoneLabel(id: string): string {
  const parts = id.split("/");
  const city = parts[parts.length - 1].replace(/_/g, " ");
  return city;
}

export const TIMEZONE_GROUPS: TimezoneGroup[] = Object.entries(ZONE_REGIONS).map(([region, zones]) => ({
  region,
  zones: zones.map((id) => ({ id, label: zoneLabel(id) })).sort((a, b) => a.label.localeCompare(b.label)),
}));

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatInZone(
  iso: string | null | undefined,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      ...options,
    }).format(d);
  } catch {
    try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
  }
}

export function formatDateInZone(iso: string | null | undefined, timezone: string): string {
  return formatInZone(iso, timezone, { hour: undefined, minute: undefined });
}

export function formatTimeInZone(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  }
}

export function zoneOffsetLabel(timezone: string): string {
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const tz = formatted.find((p) => p.type === "timeZoneName");
    return tz ? tz.value : "UTC";
  } catch {
    return "UTC";
  }
}

export function localNowInZone(timezone: string): Date {
  try {
    const now = new Date();
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const m: Record<string, string> = {};
    for (const p of offset) { if (p.type !== "literal") m[p.type] = p.value; }
    return new Date(Number(m.year), Number(m.month) - 1, Number(m.day), Number(m.hour), Number(m.minute), Number(m.second));
  } catch {
    return new Date();
  }
}
