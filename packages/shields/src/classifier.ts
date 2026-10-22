import { normalizeRoadReferences } from './normalizer.js';
import type {
  ClassifiedRoad,
  FunctionalRoadClass,
  NormalizedRouteRef,
  OsmRoadInput,
  RoadClassTag,
  ShieldDescriptor,
  ShieldFamily,
} from './types.js';

export function buildShieldSpriteId(
  family: ShieldFamily,
  code: string,
  header: string | undefined,
  theme: 'light' | 'dark' = 'light',
): string {
  const safeHeader = (header || '').replace(/:/g, '_');
  const safeCode = code.replace(/:/g, '_');
  return `shield:${family}:${safeHeader}:${safeCode}:${theme}`;
}

export function parseShieldSpriteId(spriteId: string): {
  family: ShieldFamily;
  header?: string;
  code: string;
  theme: 'light' | 'dark';
} | null {
  if (!spriteId.startsWith('shield:')) return null;
  const parts = spriteId.split(':');
  if (parts.length < 5) return null;
  const family = parts[1] as ShieldFamily;
  const header = parts[2] || undefined;
  const theme = parts[parts.length - 1] === 'dark' ? 'dark' : 'light';
  const code = parts.slice(3, parts.length - 1).join(':');
  return { family, header, code, theme };
}

function shieldPriorityAndMinZoom(ref: NormalizedRouteRef): { priority: number; minZoom: number } {
  switch (ref.family) {
    case 'IN_EXPRESSWAY':
    case 'US_I':
    case 'DE_A':
    case 'GB_M':
    case 'FR_A':
    case 'JP_E':
    case 'CN_G':
    case 'CA_TCH':
    case 'MY_E':
    case 'PK_M':
      return { priority: 100, minZoom: 5 };
    case 'IN_NH':
    case 'US_US':
    case 'GB_A':
    case 'DE_B':
    case 'FR_N':
    case 'AU_M':
    case 'AU_A':
    case 'AU_NAT':
    case 'JP_R':
    case 'CN_NAT':
    case 'BR_FED':
    case 'ZA_N':
    case 'MY_FT':
    case 'ID_TOLL':
    case 'ID_NAS':
    case 'PK_N':
    case 'BD_N':
    case 'NP_H':
      return { priority: 90, minZoom: 6 };
    case 'INT_AH':
    case 'INT_E':
      return { priority: 82, minZoom: 6 };
    case 'IN_SH':
    case 'US_SR':
    case 'CA_PROV':
    case 'GB_B':
    case 'BR_STATE':
    case 'ZA_R':
    case 'BD_R':
    case 'NP_F':
      return { priority: 70, minZoom: 8 };
    case 'IN_MDR':
    case 'GENERIC_HEXA':
    case 'TOLL_BADGE':
      return { priority: 50, minZoom: 10 };
  }
}

/**
 * Multi-dimensional road classification pipeline.
 * Preserves orthogonal attributes (functional class, official designation,
 * toll status, controlled-access, ring/bypass, national/subnational/international refs,
 * and source confidence) without collapsing them into a single exclusive bucket.
 */
export function classifyRoad(
  input: OsmRoadInput,
  theme: 'light' | 'dark' = 'light',
): ClassifiedRoad {
  const refs = normalizeRoadReferences(input);
  const hw = (input.highway || '').toLowerCase().trim();
  const combinedName = `${input.official_name || ''} ${input.name || ''}`.trim();

  const classes = new Set<RoadClassTag>();
  const isToll =
    input.toll === 'yes' ||
    input.toll === 'true' ||
    refs.some((r) => r.family === 'ID_TOLL');
  if (isToll) classes.add('toll_road');

  const isRingOrBypass = /\b(ring\s+road|outer\s+ring|inner\s+ring|bypass|périphérique|beltway)\b/i.test(
    combinedName,
  );
  if (isRingOrBypass) classes.add('ring_road');

  const isExpresswayDesignated =
    input.expressway === 'yes' ||
    /\bexpressway\b/i.test(combinedName) ||
    refs.some((r) =>
      ['IN_EXPRESSWAY', 'JP_E', 'CN_G', 'MY_E'].includes(r.family),
    );
  if (isExpresswayDesignated) classes.add('expressway');

  const isControlledAccess =
    hw === 'motorway' ||
    hw === 'motorway_link' ||
    input.motorroad === 'yes' ||
    isExpresswayDesignated;
  if (hw === 'motorway' || hw === 'motorway_link' || input.motorroad === 'yes') {
    classes.add('motorway');
  }

  // Categorize references by scope without losing co-membership
  const internationalReferences = refs.filter((r) => r.scope === 'international');
  const nationalReferences = refs.filter((r) => r.scope === 'national');
  const subnationalReferences = refs.filter(
    (r) => r.scope === 'subnational' || r.scope === 'local',
  );

  if (internationalReferences.length > 0) {
    classes.add('international_corridor');
  }

  for (const r of refs) {
    if (r.family === 'US_I') classes.add('interstate_highway');
    if (['US_US', 'BR_FED', 'DE_B', 'MY_FT'].includes(r.family)) classes.add('federal_highway');
    if (
      ['IN_NH', 'GB_A', 'FR_N', 'AU_NAT', 'AU_A', 'JP_R', 'CN_NAT', 'ZA_N', 'ID_NAS', 'PK_N', 'BD_N', 'NP_H'].includes(
        r.family,
      )
    ) {
      classes.add('national_highway');
    }
    if (['IN_SH', 'US_SR', 'BR_STATE'].includes(r.family)) classes.add('state_highway');
    if (['CA_PROV'].includes(r.family)) classes.add('provincial_highway');
    if (['ZA_R', 'BD_R', 'GB_B', 'NP_F'].includes(r.family)) classes.add('regional_highway');
    if (r.family === 'IN_MDR') classes.add('district_road');
  }

  // Functional road class & fallback OSM highway mapping
  let functionalClass: FunctionalRoadClass = 'local_street';
  if (isExpresswayDesignated) {
    functionalClass = 'expressway';
  } else if (hw === 'motorway' || hw === 'motorway_link') {
    functionalClass = 'motorway';
  } else if (classes.has('national_highway') || classes.has('interstate_highway') || classes.has('federal_highway') || hw === 'trunk' || hw === 'trunk_link') {
    functionalClass = 'national_highway';
    if (hw === 'trunk' && !classes.has('national_highway')) classes.add('urban_highway');
  } else if (classes.has('state_highway') || classes.has('provincial_highway')) {
    functionalClass = 'state_highway';
  } else if (hw === 'primary' || hw === 'primary_link') {
    functionalClass = 'primary';
    classes.add('primary');
    classes.add('arterial');
  } else if (hw === 'secondary' || hw === 'secondary_link') {
    functionalClass = 'secondary';
    classes.add('secondary');
  } else if (hw === 'tertiary' || hw === 'tertiary_link') {
    functionalClass = 'tertiary';
    classes.add('tertiary');
  } else if (hw === 'service' || hw === 'track') {
    functionalClass = 'service_road';
    classes.add('service_road');
  } else if (hw === 'unclassified') {
    functionalClass = 'local_street';
    classes.add('rural_road');
  } else {
    functionalClass = 'local_street';
    classes.add('local_street');
  }

  // Build deduplicated, priority-sorted ShieldDescriptors
  const shields: ShieldDescriptor[] = refs
    .map((ref) => {
      const { priority, minZoom } = shieldPriorityAndMinZoom(ref);
      return {
        spriteId: buildShieldSpriteId(ref.family, ref.code, ref.header, theme),
        family: ref.family,
        code: ref.code,
        header: ref.header,
        displayRef: ref.displayRef,
        network: ref.network,
        countryCode: ref.countryCode,
        isInternational: ref.scope === 'international',
        isToll,
        minZoom,
        priority,
        confidence: ref.confidence,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  // Append an auxiliary TOLL badge if toll=yes and road has at least one primary highway class
  if (isToll && shields.length > 0 && !shields.some((s) => s.family === 'ID_TOLL')) {
    shields.push({
      spriteId: buildShieldSpriteId('TOLL_BADGE', 'TOLL', undefined, theme),
      family: 'TOLL_BADGE',
      code: 'TOLL',
      displayRef: 'TOLL',
      isInternational: false,
      isToll: true,
      minZoom: 9,
      priority: 30,
      confidence: 'verified',
    });
  }

  const primaryNonIntl = shields.find((s) => !s.isInternational && s.family !== 'TOLL_BADGE');
  const primaryIntl = shields.find((s) => s.isInternational);
  const primaryShield = primaryNonIntl ?? primaryIntl ?? shields[0];
  const secondaryShield =
    primaryNonIntl && primaryIntl
      ? primaryIntl
      : shields.find((s) => s !== primaryShield && s.family !== 'TOLL_BADGE');

  let officialDesignation: string | undefined;
  if (primaryShield) {
    switch (primaryShield.family) {
      case 'IN_EXPRESSWAY':
        officialDesignation = 'Indian Expressway';
        break;
      case 'IN_NH':
        officialDesignation = 'Indian National Highway';
        break;
      case 'IN_SH':
        officialDesignation = 'Indian State Highway';
        break;
      case 'US_I':
        officialDesignation = 'US Interstate Highway';
        break;
      case 'US_US':
        officialDesignation = 'US Numbered Highway';
        break;
      case 'DE_A':
        officialDesignation = 'German Bundesautobahn';
        break;
      case 'GB_M':
        officialDesignation = 'UK Motorway';
        break;
      case 'INT_AH':
        officialDesignation = 'Asian Highway Network';
        break;
      case 'INT_E':
        officialDesignation = 'European E-Road Network';
        break;
    }
  }

  const parsedLanes =
    typeof input.lanes === 'number'
      ? input.lanes
      : input.lanes
        ? Number.parseInt(String(input.lanes), 10) || undefined
        : undefined;

  const overallConfidence =
    refs.length > 0 && refs.every((r) => r.confidence === 'verified') ? 'verified' : 'inferred';
  const overallSource = refs[0]?.source ?? 'osm_highway_tag_fallback';

  return {
    functionalClass,
    classes: Array.from(classes),
    officialDesignation,
    isControlledAccess,
    isToll,
    isRingOrBypass,
    isBridge: input.bridge === 'yes' || input.bridge === 'viaduct',
    isTunnel: input.tunnel === 'yes',
    oneway: input.oneway === 'yes' || input.oneway === '1' || hw === 'motorway',
    lanes: parsedLanes,
    maxspeed: input.maxspeed,
    surface: input.surface,
    access: input.access,
    nationalReferences,
    subnationalReferences,
    internationalReferences,
    shields,
    primarySpriteId: primaryShield?.spriteId,
    secondarySpriteId: secondaryShield?.spriteId,
    confidence: overallConfidence,
    source: overallSource,
  };
}

/**
 * Cartographic road styling palette (light & dark themes) carefully balanced
 * so road hierarchy is immediately legible without overpowering geography.
 */
export interface RoadThemePalette {
  expresswayFill: string;
  expresswayCasing: string;
  motorwayFill: string;
  motorwayCasing: string;
  nationalFill: string;
  nationalCasing: string;
  stateFill: string;
  stateCasing: string;
  primaryFill: string;
  primaryCasing: string;
  secondaryFill: string;
  secondaryCasing: string;
  localFill: string;
  localCasing: string;
  serviceFill: string;
}

export const ROAD_PALETTES: Record<'light' | 'dark', RoadThemePalette> = {
  light: {
    expresswayFill: '#F59E0B', // Signature Hexa warm amber-gold
    expresswayCasing: '#B45309',
    motorwayFill: '#FBBF24',
    motorwayCasing: '#BE7A0B',
    nationalFill: '#FDE047',
    nationalCasing: '#CA8A04',
    stateFill: '#FEF08A',
    stateCasing: '#A16207',
    primaryFill: '#FFFFFF',
    primaryCasing: '#CBD5E1',
    secondaryFill: '#F8FAFC',
    secondaryCasing: '#CBD5E1',
    localFill: '#FFFFFF',
    localCasing: '#E2E8F0',
    serviceFill: '#F1F5F9',
  },
  dark: {
    expresswayFill: '#D97706',
    expresswayCasing: '#451A03',
    motorwayFill: '#B45309',
    motorwayCasing: '#291506',
    nationalFill: '#CA8A04',
    nationalCasing: '#1E293B',
    stateFill: '#64748B',
    stateCasing: '#0F172A',
    primaryFill: '#475569',
    primaryCasing: '#0F172A',
    secondaryFill: '#334155',
    secondaryCasing: '#0F172A',
    localFill: '#1E293B',
    localCasing: '#090D16',
    serviceFill: '#1E293B',
  },
};
