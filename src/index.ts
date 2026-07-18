interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Visa Requirements MCP — passport visa rules for any nationality → destination pair
 *
 * Tools:
 * - visa_requirement: do holders of passport X need a visa for destination Y?
 * - visa_free_destinations: everywhere a passport can go visa-free / on-arrival / e-visa
 * - visa_passport_compare: "passport power" comparison of 2-5 passports
 *
 * Source: the community-maintained passport-index-dataset on GitHub
 * (ilyankou/passport-index-dataset — a periodically updated scrape of the
 * Passport Index; snapshot last updated 2026-02-18). Keyless. The 199×199
 * matrix CSV (~380 KB) is fetched on first call and cached in-isolate 24h.
 *
 * Cell vocabulary in the dataset (enumerated from the live CSV, not guessed):
 *   numeric day count (7,10,14,15,21,28,30,31,42,45,60,90,120,150,180,240,360)
 *     → visa-free with that allowed stay
 *   "visa free"        → visa-free, stay length unspecified
 *   "visa on arrival"  → visa on arrival
 *   "e-visa"           → electronic visa required before travel
 *   "eta"              → electronic travel authorization (ESTA/eTA-style)
 *   "visa required"    → embassy/consular visa required
 *   "no admission"     → entry not permitted
 *   "-1"               → same country (passport holders are citizens)
 */


const MATRIX_URL =
  'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-matrix-iso2.csv';
const DATASET_LAST_UPDATED = '2026-02-18';
const SOURCE_NOTE = `Passport Index data via the community-maintained ilyankou/passport-index-dataset on GitHub (snapshot last updated ${DATASET_LAST_UPDATED}).`;
const DISCLAIMER =
  "Community-maintained snapshot — visa rules change frequently and vary by purpose of travel, transit, and passport type; duration/transit nuances are not covered. Always verify with the destination country's official embassy/immigration sources before booking travel.";

// ---------------------------------------------------------------------------
// Country table: [iso2, iso3, canonical name, ...extra aliases]
// Exactly the 199 countries present in the dataset (same set for passports and destinations).

const COUNTRIES: [string, string, string, ...string[]][] = [
  ['AF', 'AFG', 'Afghanistan'],
  ['AL', 'ALB', 'Albania'],
  ['DZ', 'DZA', 'Algeria'],
  ['AD', 'AND', 'Andorra'],
  ['AO', 'AGO', 'Angola'],
  ['AG', 'ATG', 'Antigua and Barbuda'],
  ['AR', 'ARG', 'Argentina'],
  ['AM', 'ARM', 'Armenia'],
  ['AU', 'AUS', 'Australia'],
  ['AT', 'AUT', 'Austria'],
  ['AZ', 'AZE', 'Azerbaijan'],
  ['BS', 'BHS', 'Bahamas', 'The Bahamas'],
  ['BH', 'BHR', 'Bahrain'],
  ['BD', 'BGD', 'Bangladesh'],
  ['BB', 'BRB', 'Barbados'],
  ['BY', 'BLR', 'Belarus'],
  ['BE', 'BEL', 'Belgium'],
  ['BZ', 'BLZ', 'Belize'],
  ['BJ', 'BEN', 'Benin'],
  ['BT', 'BTN', 'Bhutan'],
  ['BO', 'BOL', 'Bolivia'],
  ['BA', 'BIH', 'Bosnia and Herzegovina', 'Bosnia'],
  ['BW', 'BWA', 'Botswana'],
  ['BR', 'BRA', 'Brazil', 'Brasil'],
  ['BN', 'BRN', 'Brunei', 'Brunei Darussalam'],
  ['BG', 'BGR', 'Bulgaria'],
  ['BF', 'BFA', 'Burkina Faso'],
  ['BI', 'BDI', 'Burundi'],
  ['KH', 'KHM', 'Cambodia'],
  ['CM', 'CMR', 'Cameroon'],
  ['CA', 'CAN', 'Canada'],
  ['CV', 'CPV', 'Cape Verde', 'Cabo Verde'],
  ['CF', 'CAF', 'Central African Republic'],
  ['TD', 'TCD', 'Chad'],
  ['CL', 'CHL', 'Chile'],
  ['CN', 'CHN', 'China', "People's Republic of China", 'PRC', 'Mainland China'],
  ['CO', 'COL', 'Colombia'],
  ['KM', 'COM', 'Comoros'],
  ['CG', 'COG', 'Congo', 'Republic of the Congo', 'Congo-Brazzaville'],
  ['CR', 'CRI', 'Costa Rica'],
  ['HR', 'HRV', 'Croatia'],
  ['CU', 'CUB', 'Cuba'],
  ['CY', 'CYP', 'Cyprus'],
  ['CZ', 'CZE', 'Czech Republic', 'Czechia'],
  ['CD', 'COD', 'DR Congo', 'Democratic Republic of the Congo', 'DRC', 'Congo-Kinshasa'],
  ['DK', 'DNK', 'Denmark'],
  ['DJ', 'DJI', 'Djibouti'],
  ['DM', 'DMA', 'Dominica'],
  ['DO', 'DOM', 'Dominican Republic'],
  ['EC', 'ECU', 'Ecuador'],
  ['EG', 'EGY', 'Egypt'],
  ['SV', 'SLV', 'El Salvador'],
  ['GQ', 'GNQ', 'Equatorial Guinea'],
  ['ER', 'ERI', 'Eritrea'],
  ['EE', 'EST', 'Estonia'],
  ['ET', 'ETH', 'Ethiopia'],
  ['FJ', 'FJI', 'Fiji'],
  ['FI', 'FIN', 'Finland'],
  ['FR', 'FRA', 'France'],
  ['GA', 'GAB', 'Gabon'],
  ['GM', 'GMB', 'Gambia', 'The Gambia'],
  ['GE', 'GEO', 'Georgia'],
  ['DE', 'DEU', 'Germany', 'Deutschland'],
  ['GH', 'GHA', 'Ghana'],
  ['GR', 'GRC', 'Greece'],
  ['GD', 'GRD', 'Grenada'],
  ['GT', 'GTM', 'Guatemala'],
  ['GN', 'GIN', 'Guinea'],
  ['GW', 'GNB', 'Guinea-Bissau'],
  ['GY', 'GUY', 'Guyana'],
  ['HT', 'HTI', 'Haiti'],
  ['HN', 'HND', 'Honduras'],
  ['HK', 'HKG', 'Hong Kong', 'Hong Kong SAR'],
  ['HU', 'HUN', 'Hungary'],
  ['IS', 'ISL', 'Iceland'],
  ['IN', 'IND', 'India'],
  ['ID', 'IDN', 'Indonesia'],
  ['IR', 'IRN', 'Iran', 'Islamic Republic of Iran'],
  ['IQ', 'IRQ', 'Iraq'],
  ['IE', 'IRL', 'Ireland', 'Republic of Ireland'],
  ['IL', 'ISR', 'Israel'],
  ['IT', 'ITA', 'Italy'],
  ['CI', 'CIV', 'Ivory Coast', "Cote d'Ivoire", "Côte d'Ivoire"],
  ['JM', 'JAM', 'Jamaica'],
  ['JP', 'JPN', 'Japan'],
  ['JO', 'JOR', 'Jordan'],
  ['KZ', 'KAZ', 'Kazakhstan'],
  ['KE', 'KEN', 'Kenya'],
  ['KI', 'KIR', 'Kiribati'],
  ['XK', 'XKX', 'Kosovo'],
  ['KW', 'KWT', 'Kuwait'],
  ['KG', 'KGZ', 'Kyrgyzstan'],
  ['LA', 'LAO', 'Laos', 'Lao PDR'],
  ['LV', 'LVA', 'Latvia'],
  ['LB', 'LBN', 'Lebanon'],
  ['LS', 'LSO', 'Lesotho'],
  ['LR', 'LBR', 'Liberia'],
  ['LY', 'LBY', 'Libya'],
  ['LI', 'LIE', 'Liechtenstein'],
  ['LT', 'LTU', 'Lithuania'],
  ['LU', 'LUX', 'Luxembourg'],
  ['MO', 'MAC', 'Macao', 'Macau', 'Macao SAR'],
  ['MG', 'MDG', 'Madagascar'],
  ['MW', 'MWI', 'Malawi'],
  ['MY', 'MYS', 'Malaysia'],
  ['MV', 'MDV', 'Maldives'],
  ['ML', 'MLI', 'Mali'],
  ['MT', 'MLT', 'Malta'],
  ['MH', 'MHL', 'Marshall Islands'],
  ['MR', 'MRT', 'Mauritania'],
  ['MU', 'MUS', 'Mauritius'],
  ['MX', 'MEX', 'Mexico'],
  ['FM', 'FSM', 'Micronesia', 'Federated States of Micronesia'],
  ['MD', 'MDA', 'Moldova'],
  ['MC', 'MCO', 'Monaco'],
  ['MN', 'MNG', 'Mongolia'],
  ['ME', 'MNE', 'Montenegro'],
  ['MA', 'MAR', 'Morocco'],
  ['MZ', 'MOZ', 'Mozambique'],
  ['MM', 'MMR', 'Myanmar', 'Burma'],
  ['NA', 'NAM', 'Namibia'],
  ['NR', 'NRU', 'Nauru'],
  ['NP', 'NPL', 'Nepal'],
  ['NL', 'NLD', 'Netherlands', 'Holland', 'The Netherlands'],
  ['NZ', 'NZL', 'New Zealand'],
  ['NI', 'NIC', 'Nicaragua'],
  ['NE', 'NER', 'Niger'],
  ['NG', 'NGA', 'Nigeria'],
  ['KP', 'PRK', 'North Korea', 'DPRK'],
  ['MK', 'MKD', 'North Macedonia', 'Macedonia'],
  ['NO', 'NOR', 'Norway'],
  ['OM', 'OMN', 'Oman'],
  ['PK', 'PAK', 'Pakistan'],
  ['PW', 'PLW', 'Palau'],
  ['PS', 'PSE', 'Palestine', 'Palestinian Territories'],
  ['PA', 'PAN', 'Panama'],
  ['PG', 'PNG', 'Papua New Guinea'],
  ['PY', 'PRY', 'Paraguay'],
  ['PE', 'PER', 'Peru'],
  ['PH', 'PHL', 'Philippines', 'The Philippines'],
  ['PL', 'POL', 'Poland'],
  ['PT', 'PRT', 'Portugal'],
  ['QA', 'QAT', 'Qatar'],
  ['RO', 'ROU', 'Romania'],
  ['RU', 'RUS', 'Russia', 'Russian Federation'],
  ['RW', 'RWA', 'Rwanda'],
  ['KN', 'KNA', 'Saint Kitts and Nevis', 'St Kitts and Nevis'],
  ['LC', 'LCA', 'Saint Lucia', 'St Lucia'],
  ['VC', 'VCT', 'Saint Vincent and the Grenadines', 'St Vincent and the Grenadines'],
  ['WS', 'WSM', 'Samoa'],
  ['SM', 'SMR', 'San Marino'],
  ['ST', 'STP', 'Sao Tome and Principe', 'São Tomé and Príncipe'],
  ['SA', 'SAU', 'Saudi Arabia', 'KSA'],
  ['SN', 'SEN', 'Senegal'],
  ['RS', 'SRB', 'Serbia'],
  ['SC', 'SYC', 'Seychelles'],
  ['SL', 'SLE', 'Sierra Leone'],
  ['SG', 'SGP', 'Singapore'],
  ['SK', 'SVK', 'Slovakia'],
  ['SI', 'SVN', 'Slovenia'],
  ['SB', 'SLB', 'Solomon Islands'],
  ['SO', 'SOM', 'Somalia'],
  ['ZA', 'ZAF', 'South Africa'],
  ['KR', 'KOR', 'South Korea', 'Korea', 'Republic of Korea', 'Korea South'],
  ['SS', 'SSD', 'South Sudan'],
  ['ES', 'ESP', 'Spain', 'España'],
  ['LK', 'LKA', 'Sri Lanka'],
  ['SD', 'SDN', 'Sudan'],
  ['SR', 'SUR', 'Suriname'],
  ['SZ', 'SWZ', 'Swaziland', 'Eswatini'],
  ['SE', 'SWE', 'Sweden'],
  ['CH', 'CHE', 'Switzerland'],
  ['SY', 'SYR', 'Syria', 'Syrian Arab Republic'],
  ['TW', 'TWN', 'Taiwan', 'Republic of China', 'Chinese Taipei'],
  ['TJ', 'TJK', 'Tajikistan'],
  ['TZ', 'TZA', 'Tanzania'],
  ['TH', 'THA', 'Thailand'],
  ['TL', 'TLS', 'Timor-Leste', 'East Timor'],
  ['TG', 'TGO', 'Togo'],
  ['TO', 'TON', 'Tonga'],
  ['TT', 'TTO', 'Trinidad and Tobago'],
  ['TN', 'TUN', 'Tunisia'],
  ['TR', 'TUR', 'Turkey', 'Türkiye', 'Turkiye'],
  ['TM', 'TKM', 'Turkmenistan'],
  ['TV', 'TUV', 'Tuvalu'],
  ['UG', 'UGA', 'Uganda'],
  ['UA', 'UKR', 'Ukraine'],
  ['AE', 'ARE', 'United Arab Emirates', 'UAE', 'Emirates'],
  ['GB', 'GBR', 'United Kingdom', 'UK', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales'],
  ['US', 'USA', 'United States', 'United States of America', 'America', 'U.S.', 'U.S.A.'],
  ['UY', 'URY', 'Uruguay'],
  ['UZ', 'UZB', 'Uzbekistan'],
  ['VU', 'VUT', 'Vanuatu'],
  ['VA', 'VAT', 'Vatican', 'Vatican City', 'Holy See'],
  ['VE', 'VEN', 'Venezuela'],
  ['VN', 'VNM', 'Vietnam', 'Viet Nam'],
  ['YE', 'YEM', 'Yemen'],
  ['ZM', 'ZMB', 'Zambia'],
  ['ZW', 'ZWE', 'Zimbabwe'],
];

const NAME_BY_ISO2 = new Map<string, string>(COUNTRIES.map((c) => [c[0], c[2]]));

/** Lowercase, strip diacritics and non-alphanumerics: "Türkiye" → "turkiye", "U.S.A." → "usa". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS_TO_ISO2 = new Map<string, string>();
for (const [iso2, iso3, ...names] of COUNTRIES) {
  ALIAS_TO_ISO2.set(normalize(iso2), iso2);
  ALIAS_TO_ISO2.set(normalize(iso3), iso2);
  for (const n of names) ALIAS_TO_ISO2.set(normalize(n), iso2);
}

function levenshtein(a: string, b: string): number {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Resolve user input (ISO2, ISO3, name, or alias) to an ISO2 code, or throw with closest matches. */
function resolveCountry(input: unknown, field: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) {
    throw new Error(
      `visa-requirements: "${field}" is required — pass a country name or ISO code, e.g. "US", "DEU", "Japan".`,
    );
  }
  const norm = normalize(raw);
  const hit = ALIAS_TO_ISO2.get(norm);
  if (hit) return hit;

  // Fuzzy suggestions: substring containment either way beats edit distance on canonical names.
  const scored: { iso2: string; name: string; score: number }[] = [];
  for (const [iso2, , name] of COUNTRIES) {
    const cn = normalize(name);
    const score = cn.includes(norm) || norm.includes(cn) ? 0.5 : levenshtein(norm, cn);
    scored.push({ iso2, name, score });
  }
  scored.sort((a, b) => a.score - b.score);
  const close = scored.filter((s) => s.score <= Math.max(2, Math.floor(norm.length / 4))).slice(0, 5);
  const hints = (close.length ? close : scored.slice(0, 3)).map((s) => `${s.name} (${s.iso2})`).join(', ');
  throw new Error(
    `visa-requirements: unknown country "${raw}" for "${field}". Closest matches: ${hints}. Pass an ISO2/ISO3 code or country name (199 countries covered; dependent territories like Puerto Rico or Greenland are not separate entries).`,
  );
}

// ---------------------------------------------------------------------------
// Matrix fetch + parse, cached in-isolate for 24h

type Matrix = Map<string, Map<string, string>>; // passport iso2 → destination iso2 → raw cell

let matrixCache: { matrix: Matrix; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getMatrix(): Promise<Matrix> {
  if (matrixCache && Date.now() - matrixCache.fetchedAt < CACHE_TTL_MS) return matrixCache.matrix;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(MATRIX_URL, { signal: controller.signal });
  } catch (e) {
    throw new Error(
      `visa-requirements: could not reach GitHub raw content (${e instanceof Error ? e.message : String(e)}). This is usually transient — retry in a few seconds.`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(
      `visa-requirements: dataset fetch failed (HTTP ${res.status} from raw.githubusercontent.com). Usually transient — retry in a few seconds; if it persists, the upstream dataset may have moved.`,
    );
  }
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((s) => s.trim());
  const dests = header.slice(1); // header[0] === 'Passport'
  const matrix: Matrix = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((s) => s.trim());
    if (cells.length !== header.length || !cells[0]) continue;
    const row = new Map<string, string>();
    for (let i = 0; i < dests.length; i++) row.set(dests[i], cells[i + 1]);
    matrix.set(cells[0], row);
  }
  if (matrix.size < 150) {
    throw new Error(
      `visa-requirements: dataset parsed to only ${matrix.size} passports (expected ~199) — upstream CSV format may have changed. Retry; if it persists, report it via pipeworx_feedback.`,
    );
  }
  matrixCache = { matrix, fetchedAt: Date.now() };
  return matrix;
}

// ---------------------------------------------------------------------------
// Cell interpretation — built from the enumerated cell vocabulary of the dataset

type Requirement =
  | 'visa_free'
  | 'visa_on_arrival'
  | 'e_visa'
  | 'eta'
  | 'visa_required'
  | 'no_admission'
  | 'citizen'
  | 'unknown';

type BucketKey = Exclude<Requirement, 'citizen' | 'unknown'>;

const REQUIREMENT_LABELS: Record<Requirement, string> = {
  visa_free: 'Visa-free entry',
  visa_on_arrival: 'Visa on arrival',
  e_visa: 'e-Visa required (apply online before travel)',
  eta: 'Electronic travel authorization (ESTA/eTA-style) required',
  visa_required: 'Visa required (apply via embassy/consulate before travel)',
  no_admission: 'No admission — entry not permitted per the dataset',
  citizen: 'Same country — passport holders are citizens/nationals of the destination',
  unknown: 'Unrecognized value in the source dataset',
};

function interpretCell(cell: string): { requirement: Requirement; allowed_stay_days?: number; raw?: string } {
  if (cell === '-1') return { requirement: 'citizen' };
  if (/^\d+$/.test(cell)) return { requirement: 'visa_free', allowed_stay_days: parseInt(cell, 10) };
  switch (cell) {
    case 'visa free':
      return { requirement: 'visa_free' };
    case 'visa on arrival':
      return { requirement: 'visa_on_arrival' };
    case 'e-visa':
      return { requirement: 'e_visa' };
    case 'eta':
      return { requirement: 'eta' };
    case 'visa required':
      return { requirement: 'visa_required' };
    case 'no admission':
      return { requirement: 'no_admission' };
    default:
      return { requirement: 'unknown', raw: cell };
  }
}

function countryRef(iso2: string): { code: string; name: string } {
  return { code: iso2, name: NAME_BY_ISO2.get(iso2) ?? iso2 };
}

type DestEntry = { code: string; name: string; allowed_stay_days?: number };

function categorize(row: Map<string, string>): Record<BucketKey, DestEntry[]> {
  const buckets: Record<BucketKey, DestEntry[]> = {
    visa_free: [],
    visa_on_arrival: [],
    e_visa: [],
    eta: [],
    visa_required: [],
    no_admission: [],
  };
  for (const [dest, cell] of row) {
    const info = interpretCell(cell);
    if (info.requirement === 'citizen' || info.requirement === 'unknown') continue;
    const entry: DestEntry = countryRef(dest);
    if (info.allowed_stay_days !== undefined) entry.allowed_stay_days = info.allowed_stay_days;
    buckets[info.requirement].push(entry);
  }
  for (const list of Object.values(buckets)) list.sort((a, b) => a.name.localeCompare(b.name));
  return buckets;
}

function bucketCounts(buckets: Record<BucketKey, DestEntry[]>): Record<BucketKey, number> {
  return Object.fromEntries(
    (Object.keys(buckets) as BucketKey[]).map((k) => [k, buckets[k].length]),
  ) as Record<BucketKey, number>;
}

// ---------------------------------------------------------------------------
// Tools

const tools: McpToolExport['tools'] = [
  {
    name: 'visa_requirement',
    description:
      'Do I need a visa? Visa requirement for one passport (nationality) traveling to one destination country — returns visa-free (with allowed stay days when known), visa on arrival, e-visa, eTA, visa required, or no admission. Covers 199×199 country pairs. Data: community-maintained Passport Index snapshot (last updated 2026-02-18) — verify with official sources before travel. Example: visa_requirement({ passport: "United States", destination: "Brazil" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        passport: {
          type: 'string',
          description: 'Passport / nationality — ISO2, ISO3, or country name, e.g. "US", "DEU", "South Korea", "UK"',
        },
        destination: {
          type: 'string',
          description: 'Destination country — ISO2, ISO3, or country name, e.g. "BR", "Japan", "Türkiye"',
        },
      },
      required: ['passport', 'destination'],
    },
  },
  {
    name: 'visa_free_destinations',
    description:
      'Where can holders of a given passport travel without a visa? Lists every destination grouped by requirement: visa-free (with allowed stay days), visa on arrival, e-visa, eTA — plus counts for visa-required and no-admission. Optional filter to a single category. Answers "visa-free countries for X passport holders". Data: Passport Index snapshot (2026-02-18). Example: visa_free_destinations({ passport: "Germany" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        passport: { type: 'string', description: 'Passport / nationality — ISO2, ISO3, or country name' },
        requirement: {
          type: 'string',
          enum: ['visa_free', 'visa_on_arrival', 'e_visa', 'eta', 'visa_required', 'no_admission'],
          description:
            'Optional: return only destinations in this category (default: full lists for visa_free, visa_on_arrival, e_visa, eta, plus counts for the rest)',
        },
      },
      required: ['passport'],
    },
  },
  {
    name: 'visa_passport_compare',
    description:
      'Compare passport power: for 2-5 passports, how many destinations each can enter visa-free / on arrival / with e-visa or eTA / visa required (passport-ranking mobility comparison). With exactly 2 passports, also lists destinations where the requirements differ (up to 30). Data: Passport Index snapshot (2026-02-18). Example: visa_passport_compare({ passports: ["US", "India"] })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        passports: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
          description: '2-5 passports to compare — ISO2, ISO3, or country names, e.g. ["US", "IN"] or ["Germany", "Japan", "Singapore"]',
        },
      },
      required: ['passports'],
    },
  },
];

// ---------------------------------------------------------------------------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'visa_requirement': {
      const passport = resolveCountry(args.passport, 'passport');
      const destination = resolveCountry(args.destination, 'destination');
      const matrix = await getMatrix();
      const cell = matrix.get(passport)?.get(destination);
      if (cell === undefined) {
        throw new Error(
          `visa-requirements: no dataset entry for ${passport} → ${destination}. This pair should exist — retry; if it persists the upstream CSV may have changed.`,
        );
      }
      const info = interpretCell(cell);
      return {
        passport: countryRef(passport),
        destination: countryRef(destination),
        requirement: info.requirement,
        requirement_label: REQUIREMENT_LABELS[info.requirement],
        ...(info.allowed_stay_days !== undefined ? { allowed_stay_days: info.allowed_stay_days } : {}),
        ...(info.requirement === 'visa_free' && info.allowed_stay_days === undefined
          ? { note: 'Dataset marks this visa-free without specifying the allowed stay length.' }
          : {}),
        ...(info.raw !== undefined ? { raw_value: info.raw } : {}),
        source: SOURCE_NOTE,
        dataset_last_updated: DATASET_LAST_UPDATED,
        disclaimer: DISCLAIMER,
      };
    }

    case 'visa_free_destinations': {
      const passport = resolveCountry(args.passport, 'passport');
      const matrix = await getMatrix();
      const row = matrix.get(passport);
      if (!row) {
        throw new Error(
          `visa-requirements: passport ${passport} not found in dataset — retry; if it persists the upstream CSV may have changed.`,
        );
      }
      const buckets = categorize(row);
      const counts = bucketCounts(buckets);
      if (args.requirement !== undefined) {
        const filter = String(args.requirement) as BucketKey;
        if (!(filter in buckets)) {
          throw new Error(
            `visa-requirements: invalid requirement filter "${String(args.requirement)}". Valid: visa_free, visa_on_arrival, e_visa, eta, visa_required, no_admission.`,
          );
        }
        return {
          passport: countryRef(passport),
          requirement: filter,
          requirement_label: REQUIREMENT_LABELS[filter],
          count: buckets[filter].length,
          destinations: buckets[filter],
          counts_all_categories: counts,
          source: SOURCE_NOTE,
          dataset_last_updated: DATASET_LAST_UPDATED,
          disclaimer: DISCLAIMER,
        };
      }
      return {
        passport: countryRef(passport),
        counts,
        visa_free: buckets.visa_free,
        visa_on_arrival: buckets.visa_on_arrival,
        e_visa: buckets.e_visa,
        eta: buckets.eta,
        note: 'visa_required and no_admission destinations are counted in "counts"; pass requirement: "visa_required" (or "no_admission") to list them.',
        source: SOURCE_NOTE,
        dataset_last_updated: DATASET_LAST_UPDATED,
        disclaimer: DISCLAIMER,
      };
    }

    case 'visa_passport_compare': {
      const rawList = args.passports;
      if (!Array.isArray(rawList) || rawList.length < 2 || rawList.length > 5) {
        throw new Error('visa-requirements: "passports" must be an array of 2-5 countries, e.g. ["US", "India"].');
      }
      const codes = rawList.map((p) => resolveCountry(p, 'passports'));
      const dupes = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))];
      if (dupes.length) {
        throw new Error(
          `visa-requirements: duplicate passport ${dupes.map((d) => NAME_BY_ISO2.get(d) ?? d).join(', ')} — pass distinct countries.`,
        );
      }
      const matrix = await getMatrix();
      const perPassport = codes.map((code) => {
        const row = matrix.get(code);
        if (!row) throw new Error(`visa-requirements: passport ${code} not found in dataset.`);
        const counts = bucketCounts(categorize(row));
        return {
          passport: countryRef(code),
          counts,
          // Passport-power style mobility score: destinations enterable without a pre-arranged visa
          mobility_score_visa_free_or_on_arrival: counts.visa_free + counts.visa_on_arrival,
        };
      });
      const result: Record<string, unknown> = {
        passports: perPassport,
        ranking_note:
          'mobility_score_visa_free_or_on_arrival counts destinations enterable without arranging a visa in advance (visa-free + visa on arrival); eTA and e-visa destinations are broken out separately in counts.',
        source: SOURCE_NOTE,
        dataset_last_updated: DATASET_LAST_UPDATED,
        disclaimer: DISCLAIMER,
      };
      if (codes.length === 2) {
        const [a, b] = codes;
        const rowA = matrix.get(a)!;
        const rowB = matrix.get(b)!;
        const nameA = NAME_BY_ISO2.get(a) ?? a;
        const nameB = NAME_BY_ISO2.get(b) ?? b;
        const differences: Record<string, string>[] = [];
        let totalDiffering = 0;
        for (const [dest, cellA] of rowA) {
          if (dest === a || dest === b) continue;
          const cellB = rowB.get(dest);
          if (cellB === undefined) continue;
          const reqA = interpretCell(cellA).requirement;
          const reqB = interpretCell(cellB).requirement;
          if (reqA !== reqB) {
            totalDiffering++;
            if (differences.length < 30) {
              differences.push({ destination: NAME_BY_ISO2.get(dest) ?? dest, [nameA]: reqA, [nameB]: reqB });
            }
          }
        }
        result.destinations_where_requirements_differ = totalDiffering;
        result.differences = differences;
        if (totalDiffering > 30) {
          result.differences_note = `Showing 30 of ${totalDiffering} differing destinations.`;
        }
      }
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
