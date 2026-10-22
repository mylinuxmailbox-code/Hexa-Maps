import type {
  ClassificationConfidence,
  ClassificationSource,
  NormalizedRouteRef,
  OsmRoadInput,
} from './types.js';

/**
 * Recognized Indian named expressways mapped to concise shield codes when OSM ways
 * carry an official expressway name without a `NE` number.
 */
const INDIA_NAMED_EXPRESSWAYS: Array<{ pattern: RegExp; code: string; displayRef: string }> = [
  {
    pattern: /\bmumbai\s*[-–—]\s*pune\s+expressway\b/i,
    code: 'MPEW',
    displayRef: 'Mumbai–Pune Expy',
  },
  {
    pattern: /\bdelhi\s*[-–—]\s*mumbai\s+expressway\b/i,
    code: 'NE 4',
    displayRef: 'NE 4',
  },
  {
    pattern: /\byamuna\s+expressway\b/i,
    code: 'YEW',
    displayRef: 'Yamuna Expy',
  },
  {
    pattern: /\bpurvanchal\s+expressway\b/i,
    code: 'PEW',
    displayRef: 'Purvanchal Expy',
  },
  {
    pattern: /\bagra\s*[-–—]\s*lucknow\s+expressway\b/i,
    code: 'ALEW',
    displayRef: 'Agra–Lucknow Expy',
  },
  {
    pattern: /\bsamruddhi\s+mahamarg\b|\bmumbai\s*[-–—]\s*nagpur\s+expressway\b/i,
    code: 'MMEW',
    displayRef: 'Samruddhi Expy',
  },
];

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const INDIAN_STATE_CODES = new Set([
  'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH',
  'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'OR',
  'PB', 'RJ', 'SK', 'TN', 'TG', 'TS', 'TR', 'UP', 'UK', 'WB',
  'DL', 'JK', 'LA', 'PY', 'CH',
]);

const EUROPEAN_E_ROAD_COUNTRIES = new Set([
  'GB', 'UK', 'DE', 'FR', 'ES', 'PT', 'IT', 'NL', 'BE', 'LU',
  'CH', 'AT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'DK',
  'SE', 'NO', 'FI', 'IE', 'EE', 'LV', 'LT', 'HR', 'SI', 'RS',
  'UA', 'TR',
]);

/**
 * Split semicolon-separated OSM ref/network strings cleanly while discarding
 * malformed noise tokens (pure punctuation, absurdly long descriptions, etc.).
 */
export function splitOsmMultiValue(value?: string): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(/[;|]/g)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => {
      if (!part || part.length > 32) return false;
      // Must contain at least one ASCII letter or digit
      if (!/[A-Za-z0-9]/.test(part)) return false;
      // Reject malformed placeholders like "---", "???", "none", "null", "TBA"
      if (/^(none|null|n\/a|unknown|tba|tbd|\?+|-+)$/i.test(part)) return false;
      return true;
    });
}

function normalizeCountry(countryCode?: string, network?: string): string | undefined {
  if (countryCode && /^[A-Za-z]{2}$/.test(countryCode.trim())) {
    const upper = countryCode.trim().toUpperCase();
    return upper === 'UK' ? 'GB' : upper;
  }
  if (network) {
    const netMatch = /^([A-Za-z]{2}):/.exec(network.trim());
    if (netMatch?.[1]) {
      const upper = netMatch[1].toUpperCase();
      return upper === 'UK' ? 'GB' : upper;
    }
  }
  return undefined;
}

interface TokenContext {
  countryCode?: string;
  subdivisionCode?: string;
  network?: string;
  highway?: string;
  expressway?: string;
  source: ClassificationSource;
}

function classifySingleToken(rawToken: string, ctx: TokenContext): NormalizedRouteRef | null {
  const cleaned = rawToken.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const net = (ctx.network || '').trim();
  const netUpper = net.toUpperCase();
  const country = normalizeCountry(ctx.countryCode, net);
  const hasExplicitNetwork = Boolean(net);
  const baseConfidence: ClassificationConfidence =
    ctx.source === 'osm_relation_network' || hasExplicitNetwork ? 'verified' : 'inferred';

  // -------------------------------------------------------------------------
  // 1. International Route Networks (Asian Highway & UNECE European E-roads)
  // Never inferred from border-crossing; only from explicit AH/E ref or network.
  // -------------------------------------------------------------------------
  const ahMatch = /^AH\s*-?\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
  if (ahMatch || /ASIANHIGHWAY|^AH$/i.test(netUpper)) {
    const num = ahMatch?.[1]?.toUpperCase() || cleaned.replace(/^AH\s*-?\s*/i, '').toUpperCase();
    if (/^\d{1,3}[A-Z]?$/.test(num)) {
      return {
        raw: rawToken,
        displayRef: `AH${num}`,
        code: `AH${num}`,
        network: 'AsianHighway',
        countryCode: country,
        scope: 'international',
        family: 'INT_AH',
        confidence: hasExplicitNetwork || Boolean(ahMatch) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }
  }

  // European E-roads: Note that in Japan (`E1`), Malaysia (`E1`), and India (`NE 1`), `E` means Expressway!
  // Only classify `E <num>` as UNECE E-road when network explicitly says `e-road` / `INT:E`
  // OR when country is a European UNECE country (and NOT Japan/Malaysia).
  const eRoadMatch = /^E\s*-?\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
  if (
    eRoadMatch &&
    (/E-ROAD|INT:E|EUR-E/i.test(netUpper) ||
      (country !== undefined && EUROPEAN_E_ROAD_COUNTRIES.has(country)))
  ) {
    const num = eRoadMatch[1]!.toUpperCase();
    return {
      raw: rawToken,
      displayRef: `E ${num}`,
      code: `E ${num}`,
      network: 'e-road',
      countryCode: country,
      scope: 'international',
      family: 'INT_E',
      confidence: /E-ROAD|INT:E/i.test(netUpper) ? 'verified' : baseConfidence,
      source: ctx.source,
    };
  }

  // -------------------------------------------------------------------------
  // 2. India (IN) — National Expressways, National Highways, State Highways, MDR
  // Note: New Hampshire in the US also uses `NH <num>` (`US:NH`)!
  // So we carefully disambiguate `NH` using countryCode & network!
  // -------------------------------------------------------------------------
  const isUSNewHampshire =
    country === 'US' || /^US:NH\b/i.test(netUpper) || ctx.subdivisionCode?.toUpperCase() === 'NH';

  if (!isUSNewHampshire) {
    // Indian National Expressway: `NE 1`, `NE 4`, `NE-2`, or `network=IN:NE`
    const inNeMatch = /^NE\s*-?\s*(\d{1,2}[A-Z]?)$/i.exec(cleaned);
    if (inNeMatch && (country === 'IN' || /^IN:NE\b/i.test(netUpper))) {
      const num = inNeMatch[1]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: `NE ${num}`,
        code: num,
        header: 'NE',
        network: 'IN:NE',
        countryCode: 'IN',
        scope: 'national',
        family: 'IN_EXPRESSWAY',
        confidence: /^IN:NE\b/i.test(netUpper) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }

    // Indian National Highway: `NH 66`, `NH66`, `NH-48`, `NH 44A`, `NH 748`
    const inNhMatch = /^NH\s*-?\s*(\d{1,4}[A-Z]{0,2})$/i.exec(cleaned);
    if (
      inNhMatch &&
      (country === 'IN' || /^IN:NH\b/i.test(netUpper) || (!country && !hasExplicitNetwork))
    ) {
      const num = inNhMatch[1]!.toUpperCase();
      // If country was omitted and network was omitted,NH could theoretically be ambiguous -> mark 'inferred'
      const conf: ClassificationConfidence =
        /^IN:NH\b/i.test(netUpper) || country === 'IN' ? 'verified' : 'inferred';
      return {
        raw: rawToken,
        displayRef: `NH ${num}`,
        code: num,
        header: 'NH',
        network: 'IN:NH',
        countryCode: country ?? 'IN',
        scope: 'national',
        family: 'IN_NH',
        confidence: conf,
        source: ctx.source,
      };
    }

    // Indian State Highway: `SH 1`, `SH-17`, `GA SH 1`, `MH SH 42`, `KA-SH-17`
    const inShMatch = /^(?:([A-Z]{2})\s*[-:\s]\s*)?SH\s*-?\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned);
    if (inShMatch && (country === 'IN' || /^IN:(?:SH|[A-Z]{2}:SH)/i.test(netUpper))) {
      const tokenState = inShMatch[1]?.toUpperCase();
      const netStateMatch = /^IN:(?:SH:([A-Z]{2})|([A-Z]{2}):SH)/i.exec(netUpper);
      const stateCode =
        tokenState ||
        netStateMatch?.[1] ||
        netStateMatch?.[2] ||
        (ctx.subdivisionCode && INDIAN_STATE_CODES.has(ctx.subdivisionCode.toUpperCase())
          ? ctx.subdivisionCode.toUpperCase()
          : undefined);
      const num = inShMatch[2]!.toUpperCase();
      const header = stateCode && INDIAN_STATE_CODES.has(stateCode) ? `${stateCode} SH` : 'SH';
      return {
        raw: rawToken,
        displayRef: stateCode ? `${stateCode} SH ${num}` : `SH ${num}`,
        code: num,
        header,
        network: stateCode ? `IN:SH:${stateCode}` : 'IN:SH',
        countryCode: 'IN',
        subdivisionCode: stateCode,
        scope: 'subnational',
        family: 'IN_SH',
        confidence: /^IN:/i.test(netUpper) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }

    // Indian Major District Road / Other District Road: `MDR 5`, `ODR 12`
    const inMdrMatch = /^(MDR|ODR)\s*-?\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned);
    if (inMdrMatch && (country === 'IN' || /^IN:MDR\b/i.test(netUpper))) {
      const prefix = inMdrMatch[1]!.toUpperCase();
      const num = inMdrMatch[2]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: `${prefix} ${num}`,
        code: num,
        header: prefix,
        network: `IN:${prefix}`,
        countryCode: 'IN',
        scope: 'local',
        family: 'IN_MDR',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. United States (US) — Interstates, US Highways, State Routes
  // -------------------------------------------------------------------------
  const usInterstateMatch = /^I\s*[- ]\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
  if (
    usInterstateMatch &&
    (country === 'US' || /^US:I\b/i.test(netUpper) || (!country && /^I-\d{1,3}$/i.test(cleaned)))
  ) {
    const num = usInterstateMatch[1]!.toUpperCase();
    return {
      raw: rawToken,
      displayRef: `I-${num}`,
      code: num,
      header: 'INTERSTATE',
      network: 'US:I',
      countryCode: 'US',
      scope: 'national',
      family: 'US_I',
      confidence: /^US:I\b/i.test(netUpper) || country === 'US' ? 'verified' : 'inferred',
      source: ctx.source,
    };
  }

  if (/^US:I\b/i.test(netUpper) && /^\d{1,3}[A-Z]?$/i.test(cleaned)) {
    const num = cleaned.toUpperCase();
    return {
      raw: rawToken,
      displayRef: `I-${num}`,
      code: num,
      header: 'INTERSTATE',
      network: 'US:I',
      countryCode: 'US',
      scope: 'national',
      family: 'US_I',
      confidence: 'verified',
      source: ctx.source,
    };
  }

  const usHwyMatch = /^US\s*[- ]\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
  if (usHwyMatch && (country === 'US' || /^US:US\b/i.test(netUpper) || !country)) {
    const num = usHwyMatch[1]!.toUpperCase();
    return {
      raw: rawToken,
      displayRef: `US ${num}`,
      code: num,
      header: 'US',
      network: 'US:US',
      countryCode: 'US',
      scope: 'national',
      family: 'US_US',
      confidence: /^US:US\b/i.test(netUpper) || country === 'US' ? 'verified' : 'inferred',
      source: ctx.source,
    };
  }

  if (/^US:US\b/i.test(netUpper) && /^\d{1,3}[A-Z]?$/i.test(cleaned)) {
    const num = cleaned.toUpperCase();
    return {
      raw: rawToken,
      displayRef: `US ${num}`,
      code: num,
      header: 'US',
      network: 'US:US',
      countryCode: 'US',
      scope: 'national',
      family: 'US_US',
      confidence: 'verified',
      source: ctx.source,
    };
  }

  // US State Routes: `NY 27`, `CA 1`, `SR 99`, `SH 121` (in US), or `network=US:NY` + `27`
  const usNetState = /^US:([A-Z]{2})$/i.exec(netUpper)?.[1];
  const usStateTokenMatch = /^(?:([A-Z]{2})|SR|SH|STATE)\s*[- ]\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned);
  if (
    country === 'US' &&
    (usStateTokenMatch || (usNetState && US_STATE_CODES.has(usNetState) && /^\d{1,4}[A-Z]?$/i.test(cleaned)))
  ) {
    const st =
      (usStateTokenMatch?.[1] && US_STATE_CODES.has(usStateTokenMatch[1].toUpperCase())
        ? usStateTokenMatch[1].toUpperCase()
        : undefined) ||
      usNetState ||
      ctx.subdivisionCode?.toUpperCase();
    const num = (usStateTokenMatch?.[2] || cleaned).toUpperCase();
    return {
      raw: rawToken,
      displayRef: st ? `${st} ${num}` : `SR ${num}`,
      code: num,
      header: st,
      network: st ? `US:${st}` : 'US:SR',
      countryCode: 'US',
      subdivisionCode: st,
      scope: 'subnational',
      family: 'US_SR',
      confidence: usNetState ? 'verified' : baseConfidence,
      source: ctx.source,
    };
  }

  // -------------------------------------------------------------------------
  // 4. Canada (CA) — Trans-Canada & Provincial/Territorial Highways
  // -------------------------------------------------------------------------
  if (country === 'CA' || /^CA:/i.test(netUpper)) {
    const tchMatch = /^(?:TCH\s*[- ]?\s*)?(\d{1,3}[A-Z]?)$/i.exec(cleaned);
    if (/^TCH\b/i.test(cleaned) || /TRANS-?CANADA|CA:TCH/i.test(netUpper)) {
      const num = tchMatch?.[1]?.toUpperCase() || cleaned.replace(/^TCH\s*/i, '') || '1';
      return {
        raw: rawToken,
        displayRef: `TCH ${num}`,
        code: num,
        header: 'TCH',
        network: 'CA:TCH',
        countryCode: 'CA',
        scope: 'national',
        family: 'CA_TCH',
        confidence: 'verified',
        source: ctx.source,
      };
    }
    const caProvMatch = /^(?:([A-Z]{2})\s*[- ]?\s*|HWY\s*)?(\d{1,4}[A-Z]?)$/i.exec(cleaned);
    if (caProvMatch) {
      const prov =
        caProvMatch[1]?.toUpperCase() ||
        /^CA:([A-Z]{2})\b/i.exec(netUpper)?.[1] ||
        ctx.subdivisionCode?.toUpperCase();
      const num = caProvMatch[2]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: prov ? `${prov} ${num}` : `Hwy ${num}`,
        code: num,
        header: prov || 'CA',
        network: prov ? `CA:${prov}` : 'CA:PROV',
        countryCode: 'CA',
        subdivisionCode: prov,
        scope: 'subnational',
        family: 'CA_PROV',
        confidence: /^CA:/i.test(netUpper) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 5. United Kingdom (GB) — Motorways (M25, A1(M)), A-roads, B-roads
  // -------------------------------------------------------------------------
  if (country === 'GB' || /^(?:GB|UK):/i.test(netUpper)) {
    const gbMotorwayMatch = /^(M\d{1,3}|A\d{1,4}\(M\))$/i.exec(cleaned.replace(/\s+/g, ''));
    if (gbMotorwayMatch) {
      const code = gbMotorwayMatch[1]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'GB:M',
        countryCode: 'GB',
        scope: 'national',
        family: 'GB_M',
        confidence: /^(?:GB|UK):/i.test(netUpper) ? 'verified' : 'verified',
        source: ctx.source,
      };
    }
    const gbAMatch = /^A(\d{1,4})$/i.exec(cleaned.replace(/\s+/g, ''));
    if (gbAMatch) {
      const code = `A${gbAMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'GB:A',
        countryCode: 'GB',
        scope: 'national',
        family: 'GB_A',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const gbBMatch = /^B(\d{1,4})$/i.exec(cleaned.replace(/\s+/g, ''));
    if (gbBMatch) {
      const code = `B${gbBMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'GB:B',
        countryCode: 'GB',
        scope: 'subnational',
        family: 'GB_B',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 6. Germany (DE) — Bundesautobahn (A 3) & Bundesstraße (B 2)
  // -------------------------------------------------------------------------
  if (country === 'DE' || /^DE:/i.test(netUpper) || /^BAB$/i.test(netUpper)) {
    const deAMatch = /^(?:BAB\s*|A\s*)(\d{1,3})$/i.exec(cleaned);
    if (deAMatch) {
      const num = deAMatch[1]!;
      return {
        raw: rawToken,
        displayRef: `A ${num}`,
        code: `A ${num}`,
        network: 'DE:BAB',
        countryCode: 'DE',
        scope: 'national',
        family: 'DE_A',
        confidence: /^DE:|BAB/i.test(netUpper) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }
    const deBMatch = /^B\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
    if (deBMatch) {
      const num = deBMatch[1]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: `B ${num}`,
        code: `B ${num}`,
        network: 'DE:BS',
        countryCode: 'DE',
        scope: 'national',
        family: 'DE_B',
        confidence: /^DE:/i.test(netUpper) ? 'verified' : baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 7. France (FR) — Autoroutes (A 1) & Routes Nationales (N 7 / RN 7)
  // -------------------------------------------------------------------------
  if (country === 'FR' || /^FR:/i.test(netUpper)) {
    const frAMatch = /^A\s*(\d{1,3}[A-Z]?)$/i.exec(cleaned);
    if (frAMatch) {
      const num = frAMatch[1]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: `A ${num}`,
        code: `A ${num}`,
        network: 'FR:A',
        countryCode: 'FR',
        scope: 'national',
        family: 'FR_A',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const frNMatch = /^R?N\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned);
    if (frNMatch) {
      const num = frNMatch[1]!.toUpperCase();
      return {
        raw: rawToken,
        displayRef: `N ${num}`,
        code: `N ${num}`,
        network: 'FR:N',
        countryCode: 'FR',
        scope: 'national',
        family: 'FR_N',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 8. Australia (AU) — Motorways (M1), Alpha Routes (A1), National Routes
  // -------------------------------------------------------------------------
  if (country === 'AU' || /^AU:/i.test(netUpper)) {
    const auMMatch = /^M\s*(\d{1,3})$/i.exec(cleaned);
    if (auMMatch) {
      const code = `M${auMMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'AU:M',
        countryCode: 'AU',
        scope: 'subnational',
        family: 'AU_M',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const auAMatch = /^A\s*(\d{1,3})$/i.exec(cleaned);
    if (auAMatch) {
      const code = `A${auAMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'AU:A',
        countryCode: 'AU',
        scope: 'national',
        family: 'AU_A',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const auNatMatch = /^(?:N|NAT\s*)?(\d{1,3})$/i.exec(cleaned);
    if (auNatMatch) {
      const num = auNatMatch[1]!;
      return {
        raw: rawToken,
        displayRef: `National ${num}`,
        code: num,
        header: 'NATIONAL',
        network: 'AU:NATIONAL',
        countryCode: 'AU',
        scope: 'national',
        family: 'AU_NAT',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 9. Japan (JP) — Expressways (E1, C1) & National Routes ("Onigiri" R1 / 246)
  // -------------------------------------------------------------------------
  if (country === 'JP' || /^JP:/i.test(netUpper)) {
    const jpExpMatch = /^([EC]\d{1,2}[A-Z]?)$/i.exec(cleaned.replace(/\s+/g, ''));
    if (jpExpMatch || /EXPRESSWAY|JP:E/i.test(netUpper)) {
      const code = (jpExpMatch?.[1] || cleaned).toUpperCase();
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'JP:E',
        countryCode: 'JP',
        scope: 'national',
        family: 'JP_E',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const jpNatMatch = /^(?:R|ROUTE\s*)?(\d{1,3})$/i.exec(cleaned);
    if (jpNatMatch) {
      const num = jpNatMatch[1]!;
      return {
        raw: rawToken,
        displayRef: `Route ${num}`,
        code: num,
        network: 'JP:NATIONAL',
        countryCode: 'JP',
        scope: 'national',
        family: 'JP_R',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 10. China (CN) — NTHS Expressways (G1..G99) & National Highways (G101+)
  // -------------------------------------------------------------------------
  if (country === 'CN' || /^CN:/i.test(netUpper)) {
    const cnGMatch = /^G\s*(\d{1,4}[A-Z]?)$/i.exec(cleaned);
    if (cnGMatch) {
      const numStr = cnGMatch[1]!.toUpperCase();
      const numeric = parseInt(numStr, 10);
      const isExpressway =
        ctx.highway === 'motorway' ||
        /EXPRESSWAY|CN:EXPRESSWAY/i.test(netUpper) ||
        (numeric >= 1 && numeric < 100);
      return {
        raw: rawToken,
        displayRef: `G${numStr}`,
        code: `G${numStr}`,
        header: isExpressway ? 'EXPWY' : 'NAT',
        network: isExpressway ? 'CN:EXPRESSWAY' : 'CN:G',
        countryCode: 'CN',
        scope: 'national',
        family: isExpressway ? 'CN_G' : 'CN_NAT',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 11. Brazil (BR) — Federal BR Routes (BR-101) & State Highways (SP-280)
  // -------------------------------------------------------------------------
  const brFedMatch = /^BR\s*-\s*(\d{3})$/i.exec(cleaned);
  if (brFedMatch || ((country === 'BR' || /^BR:/i.test(netUpper)) && /^BR\s*-?\s*\d{3}$/i.test(cleaned))) {
    const num = cleaned.replace(/^BR\s*-?\s*/i, '');
    return {
      raw: rawToken,
      displayRef: `BR-${num}`,
      code: num,
      header: 'BR',
      network: 'BR',
      countryCode: 'BR',
      scope: 'national',
      family: 'BR_FED',
      confidence: country === 'BR' || /^BR/i.test(netUpper) || Boolean(brFedMatch) ? 'verified' : baseConfidence,
      source: ctx.source,
    };
  }
  if (country === 'BR' || /^BR:/i.test(netUpper)) {
    const brStateMatch = /^([A-Z]{2})\s*[- ]\s*(\d{2,3})$/i.exec(cleaned);
    if (brStateMatch) {
      const st = brStateMatch[1]!.toUpperCase();
      const num = brStateMatch[2]!;
      return {
        raw: rawToken,
        displayRef: `${st}-${num}`,
        code: num,
        header: st,
        network: `BR:${st}`,
        countryCode: 'BR',
        subdivisionCode: st,
        scope: 'subnational',
        family: 'BR_STATE',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 12. South Africa (ZA) — National Pentagon (N1), Provincial/Regional (R44)
  // -------------------------------------------------------------------------
  if (country === 'ZA' || /^ZA:/i.test(netUpper)) {
    const zaNMatch = /^N\s*(\d{1,2})$/i.exec(cleaned);
    if (zaNMatch) {
      const code = `N${zaNMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'ZA:N',
        countryCode: 'ZA',
        scope: 'national',
        family: 'ZA_N',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const zaRMatch = /^([RM])\s*(\d{1,3})$/i.exec(cleaned);
    if (zaRMatch) {
      const code = `${zaRMatch[1]!.toUpperCase()}${zaRMatch[2]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: `ZA:${zaRMatch[1]!.toUpperCase()}`,
        countryCode: 'ZA',
        scope: 'subnational',
        family: 'ZA_R',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 13. Malaysia (MY) — Expressways (E1) & Federal Routes (FT1) Hexagons
  // -------------------------------------------------------------------------
  if (country === 'MY' || /^MY:/i.test(netUpper)) {
    const myEMatch = /^E\s*(\d{1,2})$/i.exec(cleaned);
    if (myEMatch) {
      const code = `E${myEMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'MY:E',
        countryCode: 'MY',
        scope: 'national',
        family: 'MY_E',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const myFtMatch = /^(?:FT|JKR)?\s*(\d{1,4})$/i.exec(cleaned);
    if (myFtMatch) {
      const num = myFtMatch[1]!;
      return {
        raw: rawToken,
        displayRef: `FT${num}`,
        code: num,
        header: 'FT',
        network: 'MY:FT',
        countryCode: 'MY',
        scope: 'national',
        family: 'MY_FT',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 14. Indonesia (ID), Pakistan (PK), Bangladesh (BD), Nepal (NP)
  // -------------------------------------------------------------------------
  if (country === 'ID' || /^ID:/i.test(netUpper)) {
    const isTollRef = /^TOL\b/i.test(cleaned) || /TOLL/i.test(netUpper);
    const num = cleaned.replace(/^(?:TOL|JALAN\s+NASIONAL)\s*/i, '').trim() || cleaned;
    return {
      raw: rawToken,
      displayRef: isTollRef ? `Tol ${num}` : `Nasional ${num}`,
      code: num.slice(0, 6),
      header: isTollRef ? 'TOL' : 'ID',
      network: isTollRef ? 'ID:TOLL' : 'ID:NATIONAL',
      countryCode: 'ID',
      scope: 'national',
      family: isTollRef ? 'ID_TOLL' : 'ID_NAS',
      confidence: baseConfidence,
      source: ctx.source,
    };
  }

  if (country === 'PK' || /^PK:/i.test(netUpper)) {
    const pkMMatch = /^M\s*-?\s*(\d{1,2})$/i.exec(cleaned);
    if (pkMMatch) {
      const code = `M-${pkMMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'PK:M',
        countryCode: 'PK',
        scope: 'national',
        family: 'PK_M',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const pkNMatch = /^N\s*-?\s*(\d{1,3})$/i.exec(cleaned);
    if (pkNMatch) {
      const code = `N-${pkNMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'PK:N',
        countryCode: 'PK',
        scope: 'national',
        family: 'PK_N',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  if (country === 'BD' || /^BD:/i.test(netUpper)) {
    const bdNMatch = /^N\s*-?\s*(\d{1,3})$/i.exec(cleaned);
    if (bdNMatch) {
      const code = `N${bdNMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'BD:N',
        countryCode: 'BD',
        scope: 'national',
        family: 'BD_N',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const bdRMatch = /^R\s*-?\s*(\d{1,4})$/i.exec(cleaned);
    if (bdRMatch) {
      const code = `R${bdRMatch[1]}`;
      return {
        raw: rawToken,
        displayRef: code,
        code,
        network: 'BD:R',
        countryCode: 'BD',
        scope: 'subnational',
        family: 'BD_R',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  if (country === 'NP' || /^NP:/i.test(netUpper)) {
    const npHMatch = /^H\s*-?\s*(\d{1,2})$/i.exec(cleaned);
    if (npHMatch) {
      const num = npHMatch[1]!.padStart(2, '0');
      return {
        raw: rawToken,
        displayRef: `H${num}`,
        code: `H${num}`,
        network: 'NP:NH',
        countryCode: 'NP',
        scope: 'national',
        family: 'NP_H',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
    const npFMatch = /^F\s*-?\s*(\d{1,3})$/i.exec(cleaned);
    if (npFMatch) {
      const num = npFMatch[1]!.padStart(3, '0');
      return {
        raw: rawToken,
        displayRef: `F${num}`,
        code: `F${num}`,
        network: 'NP:FEEDER',
        countryCode: 'NP',
        scope: 'subnational',
        family: 'NP_F',
        confidence: baseConfidence,
        source: ctx.source,
      };
    }
  }

  // -------------------------------------------------------------------------
  // 15. Ambiguous or Unknown Country Fallback -> GENERIC_HEXA
  // Never fabricate a country-specific shield when `A 1` or `SH 1` lacks
  // unambiguous country/network context!
  // -------------------------------------------------------------------------
  return {
    raw: rawToken,
    displayRef: cleaned,
    code: cleaned.slice(0, 8),
    network: net || undefined,
    countryCode: country,
    scope: 'national',
    family: 'GENERIC_HEXA',
    confidence: 'inferred',
    source: ctx.source,
  };
}

/**
 * Normalize all OSM route references (`ref`, `int_ref`, `nat_ref`, `reg_ref`,
 * `relations`, and recognized Indian named expressways) into deduplicated,
 * structured NormalizedRouteRef objects with explicit provenance & confidence.
 */
export function normalizeRoadReferences(input: OsmRoadInput): NormalizedRouteRef[] {
  const results: NormalizedRouteRef[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (ref: NormalizedRouteRef | null) => {
    if (!ref) return;
    const dedupeKey = `${ref.family}::${ref.displayRef.toUpperCase()}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    results.push(ref);
  };

  // 1. Highest-confidence source: explicit OSM route relations
  if (Array.isArray(input.relations)) {
    for (const rel of input.relations) {
      const relTokens = splitOsmMultiValue(rel.ref);
      for (const token of relTokens) {
        pushUnique(
          classifySingleToken(token, {
            countryCode: input.countryCode,
            subdivisionCode: input.subdivisionCode,
            network: rel.network || input.network,
            highway: input.highway,
            expressway: input.expressway,
            source: 'osm_relation_network',
          }),
        );
      }
    }
  }

  // 2. Way-level `ref`, `nat_ref`, `reg_ref`, `int_ref` paired with semicolon-aligned `network`
  const networks = splitOsmMultiValue(input.network);
  const refTokens = splitOsmMultiValue(input.ref);
  refTokens.forEach((token, idx) => {
    const pairedNetwork = networks[idx] ?? networks[0];
    pushUnique(
      classifySingleToken(token, {
        countryCode: input.countryCode,
        subdivisionCode: input.subdivisionCode,
        network: pairedNetwork,
        highway: input.highway,
        expressway: input.expressway,
        source: pairedNetwork ? 'osm_relation_network' : 'osm_ref_and_country_rule',
      }),
    );
  });

  for (const natToken of splitOsmMultiValue(input.nat_ref)) {
    pushUnique(
      classifySingleToken(natToken, {
        countryCode: input.countryCode,
        subdivisionCode: input.subdivisionCode,
        network: networks[0],
        highway: input.highway,
        expressway: input.expressway,
        source: 'osm_ref_and_country_rule',
      }),
    );
  }

  for (const regToken of splitOsmMultiValue(input.reg_ref)) {
    pushUnique(
      classifySingleToken(regToken, {
        countryCode: input.countryCode,
        subdivisionCode: input.subdivisionCode,
        network: networks[0],
        highway: input.highway,
        expressway: input.expressway,
        source: 'osm_ref_and_country_rule',
      }),
    );
  }

  for (const intToken of splitOsmMultiValue(input.int_ref)) {
    pushUnique(
      classifySingleToken(intToken, {
        countryCode: input.countryCode,
        subdivisionCode: input.subdivisionCode,
        network: /^AH/i.test(intToken) ? 'AsianHighway' : /^E/i.test(intToken) ? 'e-road' : undefined,
        highway: input.highway,
        expressway: input.expressway,
        source: 'osm_ref_and_country_rule',
      }),
    );
  }

  // 3. Recognized Indian named expressways (e.g., Mumbai–Pune Expressway, Yamuna Expressway)
  const combinedName = `${input.official_name || ''} ${input.name || ''}`.trim();
  if (combinedName) {
    for (const exp of INDIA_NAMED_EXPRESSWAYS) {
      if (exp.pattern.test(combinedName)) {
        const alreadyHasExpresswayShield = results.some((r) => r.family === 'IN_EXPRESSWAY');
        if (!alreadyHasExpresswayShield) {
          pushUnique({
            raw: input.official_name || input.name || exp.displayRef,
            displayRef: exp.displayRef,
            code: exp.code,
            header: 'EXPWY',
            network: 'IN:EXPRESSWAY',
            countryCode: 'IN',
            scope: 'national',
            family: 'IN_EXPRESSWAY',
            confidence: 'verified',
            source: 'osm_official_name',
          });
        }
      }
    }
  }

  return results;
}
