/**
 * @hexa/shields — Domain types for multi-dimensional road classification,
 * OSM route-reference normalization, and international highway shield rendering.
 */

/**
 * All 20+ supported road categories from Section 5.1.
 * A single road way can carry MULTIPLE RoadClassTags simultaneously
 * (for instance: ['motorway', 'national_highway', 'toll_road', 'international_corridor']).
 */
export type RoadClassTag =
  | 'expressway'
  | 'national_highway'
  | 'state_highway'
  | 'regional_highway'
  | 'provincial_highway'
  | 'interstate_highway'
  | 'federal_highway'
  | 'motorway'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'arterial'
  | 'urban_highway'
  | 'ring_road'
  | 'district_road'
  | 'rural_road'
  | 'local_street'
  | 'service_road'
  | 'toll_road'
  | 'international_corridor'
  | 'designated_other';

/**
 * Primary cartographic hierarchy tier used for road line width & casing styling.
 * Kept distinct from route references, toll status, and international corridors.
 */
export type FunctionalRoadClass =
  | 'expressway'
  | 'motorway'
  | 'national_highway'
  | 'state_highway'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'local_street'
  | 'service_road';

export type ShieldFamily =
  | 'IN_EXPRESSWAY'
  | 'IN_NH'
  | 'IN_SH'
  | 'IN_MDR'
  | 'US_I'
  | 'US_US'
  | 'US_SR'
  | 'CA_TCH'
  | 'CA_PROV'
  | 'GB_M'
  | 'GB_A'
  | 'GB_B'
  | 'DE_A'
  | 'DE_B'
  | 'FR_A'
  | 'FR_N'
  | 'AU_M'
  | 'AU_A'
  | 'AU_NAT'
  | 'JP_E'
  | 'JP_R'
  | 'CN_G'
  | 'CN_NAT'
  | 'BR_FED'
  | 'BR_STATE'
  | 'ZA_N'
  | 'ZA_R'
  | 'MY_E'
  | 'MY_FT'
  | 'ID_TOLL'
  | 'ID_NAS'
  | 'PK_M'
  | 'PK_N'
  | 'BD_N'
  | 'BD_R'
  | 'NP_H'
  | 'NP_F'
  | 'INT_AH'
  | 'INT_E'
  | 'TOLL_BADGE'
  | 'GENERIC_HEXA';

export type ClassificationConfidence = 'verified' | 'inferred';

export type ClassificationSource =
  | 'osm_relation_network'
  | 'osm_ref_and_country_rule'
  | 'osm_official_name'
  | 'osm_highway_tag_fallback';

/**
 * Raw OpenStreetMap attributes & optional relation memberships for a road segment.
 */
export interface OsmRoadInput {
  highway?: string;
  ref?: string;
  int_ref?: string;
  nat_ref?: string;
  reg_ref?: string;
  name?: string;
  official_name?: string;
  network?: string;
  route?: string;
  expressway?: string;
  maxspeed?: string;
  toll?: string;
  motorroad?: string;
  access?: string;
  oneway?: string;
  lanes?: string | number;
  bridge?: string;
  tunnel?: string;
  surface?: string;
  junction?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. 'IN', 'US', 'GB', 'DE') when known */
  countryCode?: string;
  /** Optional ISO 3166-2 subdivision / state code (e.g. 'GA', 'MH', 'NY', 'ON') */
  subdivisionCode?: string;
  /** Optional OSM route relation memberships */
  relations?: Array<{
    network?: string;
    ref?: string;
    name?: string;
    route?: string;
  }>;
}

export interface NormalizedRouteRef {
  /** Original unedited token from OSM `ref` / relation */
  raw: string;
  /** Normalized canonical display string (e.g. 'NH 66', 'I-95', 'A 3', 'AH47') */
  displayRef: string;
  /** Compact code rendered in the primary numeral zone of the shield (e.g. '66', '95', 'A 3', 'AH47') */
  code: string;
  /** Optional top header text inside crested shields (e.g. 'NH', 'SH', 'GA SH', 'NE', 'BR', 'US') */
  header?: string;
  /** Canonical network identifier when determined (e.g. 'IN:NH', 'US:I', 'e-road', 'AsianHighway') */
  network?: string;
  countryCode?: string;
  subdivisionCode?: string;
  scope: 'international' | 'national' | 'subnational' | 'local';
  family: ShieldFamily;
  confidence: ClassificationConfidence;
  source: ClassificationSource;
}

export interface ShieldDescriptor {
  /** Deterministic MapLibre sprite image ID: `shield:{family}:{header}:{code}:{theme}` */
  spriteId: string;
  family: ShieldFamily;
  code: string;
  header?: string;
  displayRef: string;
  network?: string;
  countryCode?: string;
  isInternational: boolean;
  isToll: boolean;
  minZoom: number;
  priority: number;
  confidence: ClassificationConfidence;
}

export interface ClassifiedRoad {
  functionalClass: FunctionalRoadClass;
  classes: RoadClassTag[];
  officialDesignation?: string;
  isControlledAccess: boolean;
  isToll: boolean;
  isRingOrBypass: boolean;
  isBridge: boolean;
  isTunnel: boolean;
  oneway: boolean;
  lanes?: number;
  maxspeed?: string;
  surface?: string;
  access?: string;
  nationalReferences: NormalizedRouteRef[];
  subnationalReferences: NormalizedRouteRef[];
  internationalReferences: NormalizedRouteRef[];
  shields: ShieldDescriptor[];
  primarySpriteId?: string;
  secondarySpriteId?: string;
  confidence: ClassificationConfidence;
  source: ClassificationSource;
}

export interface RenderedShieldSvg {
  svg: string;
  width: number;
  height: number;
  family: ShieldFamily;
  displayRef: string;
}
