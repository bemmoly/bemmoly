import type { SelectOption } from '@bemmoly/ui';

/**
 * The browser's zone list comes from CLDR, which keeps the old spellings as canonical names
 * (Asia/Calcutta, Europe/Kiev). People search for the current IANA names, so those are shown.
 */
const RENAMED: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Godthab': 'America/Nuuk',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Asia/Choibalsan': 'Asia/Ulaanbaatar',
};

/**
 * Abbreviations people type. Intl only spells most of these out in the matching locale (IST in
 * en-IN, not en-US), so the common ones are listed here. Some are shared (IST is also Israel and
 * Ireland); every zone that uses one is tagged, and the offset tells them apart.
 */
const ABBREVIATIONS: Record<string, string[]> = {
  UTC: ['UTC', 'GMT', 'Z'],
  'Asia/Kolkata': ['IST', 'India', 'Calcutta'],
  'Asia/Jerusalem': ['IST', 'IDT', 'Israel'],
  'Europe/Dublin': ['IST', 'GMT', 'Ireland'],
  'Europe/London': ['GMT', 'BST', 'UK'],
  'Europe/Lisbon': ['WET', 'WEST'],
  'Europe/Paris': ['CET', 'CEST'],
  'Europe/Berlin': ['CET', 'CEST'],
  'Europe/Madrid': ['CET', 'CEST'],
  'Europe/Rome': ['CET', 'CEST'],
  'Europe/Amsterdam': ['CET', 'CEST'],
  'Europe/Athens': ['EET', 'EEST'],
  'Europe/Kyiv': ['EET', 'EEST', 'Kiev'],
  'Europe/Moscow': ['MSK'],
  'Asia/Dubai': ['GST', 'UAE'],
  'Asia/Karachi': ['PKT', 'Pakistan'],
  'Asia/Dhaka': ['BST', 'Bangladesh'],
  'Asia/Kathmandu': ['NPT', 'Nepal'],
  'Asia/Colombo': ['SLST', 'Sri Lanka'],
  'Asia/Yangon': ['MMT', 'Myanmar', 'Rangoon'],
  'Asia/Bangkok': ['ICT'],
  'Asia/Ho_Chi_Minh': ['ICT', 'Saigon', 'Vietnam'],
  'Asia/Jakarta': ['WIB'],
  'Asia/Singapore': ['SGT', 'SST'],
  'Asia/Kuala_Lumpur': ['MYT'],
  'Asia/Manila': ['PHT', 'PST'],
  'Asia/Shanghai': ['CST', 'China', 'Beijing'],
  'Asia/Hong_Kong': ['HKT'],
  'Asia/Taipei': ['CST', 'Taiwan'],
  'Asia/Tokyo': ['JST', 'Japan'],
  'Asia/Seoul': ['KST', 'Korea'],
  'Australia/Perth': ['AWST'],
  'Australia/Adelaide': ['ACST', 'ACDT'],
  'Australia/Darwin': ['ACST'],
  'Australia/Brisbane': ['AEST'],
  'Australia/Sydney': ['AEST', 'AEDT'],
  'Australia/Melbourne': ['AEST', 'AEDT'],
  'Pacific/Auckland': ['NZST', 'NZDT', 'New Zealand'],
  'Pacific/Honolulu': ['HST', 'Hawaii'],
  'America/Anchorage': ['AKST', 'AKDT', 'Alaska'],
  'America/Los_Angeles': ['PST', 'PDT', 'PT', 'Pacific'],
  'America/Denver': ['MST', 'MDT', 'MT', 'Mountain'],
  'America/Phoenix': ['MST', 'Arizona'],
  'America/Chicago': ['CST', 'CDT', 'CT', 'Central'],
  'America/New_York': ['EST', 'EDT', 'ET', 'Eastern'],
  'America/Halifax': ['AST', 'ADT', 'Atlantic'],
  'America/St_Johns': ['NST', 'NDT', 'Newfoundland'],
  'America/Sao_Paulo': ['BRT', 'Brazil'],
  'America/Argentina/Buenos_Aires': ['ART', 'Argentina'],
  'America/Mexico_City': ['CST', 'Mexico'],
  'Africa/Lagos': ['WAT', 'Nigeria'],
  'Africa/Cairo': ['EET', 'EEST', 'Egypt'],
  'Africa/Johannesburg': ['SAST', 'South Africa'],
  'Africa/Nairobi': ['EAT', 'Kenya'],
};

/** The current IANA name for a zone the browser may spell the old way. */
export function canonicalZone(zone: string): string {
  return RENAMED[zone] ?? zone;
}

/** "GMT+05:30" now, or "GMT" for UTC; empty when the runtime does not know the zone. */
function offsetOf(zone: string, now: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}

function longName(zone: string, now: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName');
    // Zones without a name come back as their offset, which the description already shows.
    return part && !part.value.startsWith('GMT') ? part.value : '';
  } catch {
    return '';
  }
}

/** IANA zones, current names, with UTC first: the default for schedules. */
export const TIMEZONES: readonly string[] = [
  'UTC',
  ...Array.from(
    new Set(
      Intl.supportedValuesOf('timeZone')
        .map(canonicalZone)
        .filter((zone) => zone !== 'UTC'),
    ),
  ).sort(),
];

/**
 * Select options: the IANA name as the label, and the offset, long name and abbreviations as the
 * description, which search matches too, so "IST", "India" or "+05:30" all find Asia/Kolkata.
 */
export function timezoneOptions(current?: string): SelectOption[] {
  const now = new Date();
  const zones = current && !TIMEZONES.includes(current) ? [current, ...TIMEZONES] : TIMEZONES;
  return zones.map((zone) => {
    const parts = [offsetOf(zone, now), longName(zone, now), ...(ABBREVIATIONS[zone] ?? [])];
    const description = Array.from(new Set(parts.filter(Boolean))).join(' · ');
    return description ? { value: zone, label: zone, description } : { value: zone, label: zone };
  });
}
