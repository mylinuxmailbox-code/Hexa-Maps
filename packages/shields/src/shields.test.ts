import { describe, expect, it } from 'vitest';
import {
  classifyRoad,
  normalizeRoadReferences,
  renderShieldBySpriteId,
  renderShieldSvg,
  splitOsmMultiValue,
} from './index.js';

describe('@hexa/shields — Highway Classification & International Shield System', () => {
  it('1. normalizes Indian National Highway references (NH 66, NH48, NH-44A)', () => {
    const nh66 = classifyRoad({
      highway: 'trunk',
      ref: 'NH 66',
      network: 'IN:NH',
      countryCode: 'IN',
      lanes: '4',
      maxspeed: '80',
    });
    expect(nh66.functionalClass).toBe('national_highway');
    expect(nh66.classes).toContain('national_highway');
    expect(nh66.confidence).toBe('verified');
    expect(nh66.nationalReferences[0]?.displayRef).toBe('NH 66');
    expect(nh66.nationalReferences[0]?.family).toBe('IN_NH');

    // Alphanumeric spur with hyphen and missing spacing
    const nh44a = normalizeRoadReferences({ ref: 'NH-44A', countryCode: 'IN' });
    expect(nh44a[0]?.displayRef).toBe('NH 44A');
    expect(nh44a[0]?.code).toBe('44A');
  });

  it('2. normalizes Indian State Highway & Named Expressway references without conflating motorway', () => {
    const sh1 = classifyRoad({
      highway: 'primary',
      ref: 'SH 1',
      network: 'IN:SH:GA',
      countryCode: 'IN',
      subdivisionCode: 'GA',
    });
    expect(sh1.functionalClass).toBe('state_highway');
    expect(sh1.subnationalReferences[0]?.family).toBe('IN_SH');
    expect(sh1.subnationalReferences[0]?.header).toBe('GA SH');
    expect(sh1.subnationalReferences[0]?.displayRef).toBe('GA SH 1');

    // Named Indian Expressway on an OSM trunk/motorway with toll
    const mpew = classifyRoad({
      highway: 'motorway',
      name: 'Mumbai–Pune Expressway',
      toll: 'yes',
      countryCode: 'IN',
    });
    expect(mpew.functionalClass).toBe('expressway');
    expect(mpew.classes).toContain('expressway');
    expect(mpew.classes).toContain('motorway');
    expect(mpew.classes).toContain('toll_road');
    expect(mpew.nationalReferences[0]?.family).toBe('IN_EXPRESSWAY');
    expect(mpew.nationalReferences[0]?.code).toBe('MPEW');
  });

  it('3. normalizes US Interstate, US Highway, and US State Route references (including New Hampshire NH!)', () => {
    const i95 = classifyRoad({
      highway: 'motorway',
      ref: 'I 95;US 1',
      network: 'US:I;US:US',
      countryCode: 'US',
    });
    expect(i95.classes).toContain('interstate_highway');
    expect(i95.classes).toContain('federal_highway');
    expect(i95.nationalReferences.map((r) => r.family)).toEqual(['US_I', 'US_US']);

    // Crucial disambiguation: `NH 16` in the US (`countryCode: 'US'`) is New Hampshire Route 16, NOT Indian NH 16!
    const nh16US = classifyRoad({
      highway: 'primary',
      ref: 'NH 16',
      network: 'US:NH',
      countryCode: 'US',
      subdivisionCode: 'NH',
    });
    expect(nh16US.subnationalReferences[0]?.family).toBe('US_SR');
    expect(nh16US.subnationalReferences[0]?.displayRef).toBe('NH 16');
  });

  it('4. normalizes UK Motorways (M25, A1(M)), Primary A-roads, and B-roads', () => {
    const m25 = classifyRoad({ highway: 'motorway', ref: 'M25', countryCode: 'GB' });
    expect(m25.nationalReferences[0]?.family).toBe('GB_M');

    const a1m = classifyRoad({ highway: 'motorway', ref: 'A1(M)', countryCode: 'GB' });
    expect(a1m.nationalReferences[0]?.family).toBe('GB_M');
    expect(a1m.nationalReferences[0]?.code).toBe('A1(M)');

    const a40 = classifyRoad({ highway: 'trunk', ref: 'A40', countryCode: 'GB' });
    expect(a40.nationalReferences[0]?.family).toBe('GB_A');

    const b500 = classifyRoad({ highway: 'secondary', ref: 'B500', countryCode: 'GB' });
    expect(b500.subnationalReferences[0]?.family).toBe('GB_B');
  });

  it('5. normalizes German Autobahn (A 3) and Bundesstraße (B 2) alongside European E-roads', () => {
    const a3 = classifyRoad({
      highway: 'motorway',
      ref: 'A 3',
      int_ref: 'E 45',
      network: 'DE:BAB',
      countryCode: 'DE',
    });
    expect(a3.nationalReferences[0]?.family).toBe('DE_A');
    expect(a3.nationalReferences[0]?.displayRef).toBe('A 3');
    expect(a3.internationalReferences[0]?.family).toBe('INT_E');
    expect(a3.internationalReferences[0]?.displayRef).toBe('E 45');
    expect(a3.classes).toContain('international_corridor');
    // Both national and international sprite IDs are preserved independently
    expect(a3.primarySpriteId).toContain('DE_A');
    expect(a3.secondarySpriteId).toContain('INT_E');

    const b2 = classifyRoad({ highway: 'primary', ref: 'B 2', countryCode: 'DE' });
    expect(b2.nationalReferences[0]?.family).toBe('DE_B');
  });

  it('6. preserves co-membership on Indian National Highways + Asian Highway corridors + Toll', () => {
    const nh48 = classifyRoad({
      highway: 'trunk',
      ref: 'NH 48;AH47',
      network: 'IN:NH;AsianHighway',
      toll: 'yes',
      countryCode: 'IN',
    });
    expect(nh48.isToll).toBe(true);
    expect(nh48.classes).toEqual(
      expect.arrayContaining(['national_highway', 'toll_road', 'international_corridor']),
    );
    expect(nh48.nationalReferences[0]?.displayRef).toBe('NH 48');
    expect(nh48.internationalReferences[0]?.displayRef).toBe('AH47');
    expect(nh48.shields.map((s) => s.family)).toEqual(['IN_NH', 'INT_AH', 'TOLL_BADGE']);
  });

  it('7. supports Japan Onigiri National Routes, Malaysia Hexagons, South Africa Pentagons, Brazil BR, Canada, Australia, China, Pakistan, Bangladesh, Nepal, Indonesia', () => {
    expect(classifyRoad({ ref: '1', countryCode: 'JP', highway: 'trunk' }).nationalReferences[0]?.family).toBe('JP_R');
    expect(classifyRoad({ ref: 'E1', countryCode: 'JP', highway: 'motorway' }).nationalReferences[0]?.family).toBe('JP_E');
    expect(classifyRoad({ ref: 'E1', int_ref: 'AH2', countryCode: 'MY' }).nationalReferences[0]?.family).toBe('MY_E');
    expect(classifyRoad({ ref: 'N1', countryCode: 'ZA' }).nationalReferences[0]?.family).toBe('ZA_N');
    expect(classifyRoad({ ref: 'BR-101', countryCode: 'BR' }).nationalReferences[0]?.family).toBe('BR_FED');
    expect(classifyRoad({ ref: 'TCH 1', countryCode: 'CA' }).nationalReferences[0]?.family).toBe('CA_TCH');
    expect(classifyRoad({ ref: 'M1', countryCode: 'AU' }).subnationalReferences[0]?.family).toBe('AU_M');
    expect(classifyRoad({ ref: 'G4', countryCode: 'CN', highway: 'motorway' }).nationalReferences[0]?.family).toBe('CN_G');
    expect(classifyRoad({ ref: 'M-2', countryCode: 'PK' }).nationalReferences[0]?.family).toBe('PK_M');
    expect(classifyRoad({ ref: 'N1', countryCode: 'BD' }).nationalReferences[0]?.family).toBe('BD_N');
    expect(classifyRoad({ ref: 'H01', countryCode: 'NP' }).nationalReferences[0]?.family).toBe('NP_H');
    expect(classifyRoad({ ref: 'Tol 1', countryCode: 'ID' }).nationalReferences[0]?.family).toBe('ID_TOLL');
  });

  it('8. handles missing, malformed, ambiguous, unknown-country, and duplicate references safely', () => {
    // Missing references
    const residential = classifyRoad({ highway: 'residential', name: '18th June Road', countryCode: 'IN' });
    expect(residential.shields).toHaveLength(0);
    expect(residential.functionalClass).toBe('local_street');
    expect(residential.confidence).toBe('inferred');

    // Malformed references filtered cleanly
    expect(splitOsmMultiValue('---; ??? ; null ; TBA ; NH 66 ;   ')).toEqual(['NH 66']);

    // Ambiguous reference `A 1` with unknown country code -> falls back to GENERIC_HEXA with confidence='inferred'
    const ambiguous = classifyRoad({ highway: 'primary', ref: 'A 1', countryCode: 'ZZ' });
    expect(ambiguous.nationalReferences[0]?.family).toBe('GENERIC_HEXA');
    expect(ambiguous.confidence).toBe('inferred');

    // Duplicate suppression across relation + way ref + nat_ref
    const dupes = classifyRoad({
      highway: 'trunk',
      ref: 'NH 66; NH66 ; nh-66',
      nat_ref: 'NH 66',
      countryCode: 'IN',
      relations: [{ network: 'IN:NH', ref: 'NH 66' }],
    });
    expect(dupes.nationalReferences).toHaveLength(1);
    expect(dupes.shields).toHaveLength(1);
  });

  it('9. renders valid, crisp vector SVGs for all shield families and spriteIds in light & dark mode', () => {
    const nh66Svg = renderShieldSvg({ family: 'IN_NH', header: 'NH', code: '66', theme: 'light' });
    expect(nh66Svg.svg).toContain('<svg');
    expect(nh66Svg.svg).toContain('NH');
    expect(nh66Svg.svg).toContain('66');

    const jpOnigiri = renderShieldSvg({ family: 'JP_R', code: '246', theme: 'dark' });
    expect(jpOnigiri.svg).toContain('246');

    const fallback = renderShieldBySpriteId('invalid-sprite-id');
    expect(fallback.family).toBe('GENERIC_HEXA');
  });
});
