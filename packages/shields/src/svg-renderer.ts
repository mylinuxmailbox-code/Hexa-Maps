import { parseShieldSpriteId } from './classifier.js';
import type { RenderedShieldSvg, ShieldFamily } from './types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface ShieldRenderOptions {
  family: ShieldFamily;
  code: string;
  header?: string;
  theme?: 'light' | 'dark';
}

/**
 * Generates bespoke, original vector SVG artwork for 24+ country & international
 * highway shield systems. Designed for crisp legibility at map icon sizes (24–44px)
 * and scalable vector display in turn-by-turn navigation & road inspector cards.
 */
export function renderShieldSvg(options: ShieldRenderOptions): RenderedShieldSvg {
  const { family, theme = 'light' } = options;
  const code = options.code.trim() || '?';
  const header = options.header?.trim();
  const safeCode = escapeXml(code);
  const safeHeader = header ? escapeXml(header) : '';

  const fontStack = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const charCount = code.length;
  const haloStroke = theme === 'dark' ? '#090D16' : '#FFFFFF';

  switch (family) {
    // =========================================================================
    // INDIA — National Highway Milestone Crest (Saffron/Amber Arch + Ivory Body)
    // =========================================================================
    case 'IN_NH': {
      const w = Math.max(46, 26 + charCount * 9);
      const h = 42;
      const mid = w / 2;
      const bodyFill = theme === 'dark' ? '#FEFCE8' : '#FFFFFF';
      const hdrText = safeHeader || 'NH';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M4,15 C4,6 ${mid - 12},2 ${mid},2 C${mid + 12},2 ${w - 4},6 ${w - 4},15 L${w - 4},30 C${w - 4},36 ${mid + 8},40 ${mid},40 C${mid - 8},40 4,36 4,30 Z" fill="${bodyFill}" stroke="${haloStroke}" stroke-width="3"/>
  <path d="M4,15 C4,6 ${mid - 12},2 ${mid},2 C${mid + 12},2 ${w - 4},6 ${w - 4},15 L${w - 4},30 C${w - 4},36 ${mid + 8},40 ${mid},40 C${mid - 8},40 4,36 4,30 Z" fill="${bodyFill}" stroke="#1E293B" stroke-width="1.6"/>
  <path d="M4.8,16 C4.8,7.2 ${mid - 11},2.8 ${mid},2.8 C${mid + 11},2.8 ${w - 4.8},7.2 ${w - 4.8},16 L4.8,16 Z" fill="#F59E0B"/>
  <line x1="4.8" y1="16" x2="${w - 4.8}" y2="16" stroke="#1E293B" stroke-width="1.3"/>
  <text x="${mid}" y="12.6" text-anchor="middle" font-family="${fontStack}" font-size="8.5" font-weight="800" letter-spacing="0.6" fill="#111827">${hdrText}</text>
  <text x="${mid}" y="31.2" text-anchor="middle" font-family="${fontStack}" font-size="${charCount > 4 ? 11.5 : 13.5}" font-weight="900" fill="#0F172A">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `${header || 'NH'} ${code}` };
    }

    // =========================================================================
    // INDIA — National / State Expressway Twin-Bevel Emerald & Gold Crest
    // =========================================================================
    case 'IN_EXPRESSWAY': {
      const w = Math.max(54, 28 + charCount * 9.5);
      const h = 40;
      const mid = w / 2;
      const hdrText = safeHeader || 'EXPWY';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <polygon points="9,2 ${w - 9},2 ${w - 2},10 ${w - 2},30 ${w - 9},38 9,38 2,30 2,10" fill="#065F46" stroke="${haloStroke}" stroke-width="2.8" stroke-linejoin="round"/>
  <polygon points="9,2 ${w - 9},2 ${w - 2},10 ${w - 2},30 ${w - 9},38 9,38 2,30 2,10" fill="#047857" stroke="#FBBF24" stroke-width="1.6" stroke-linejoin="round"/>
  <polygon points="10,3.5 ${w - 10},3.5 ${w - 4},10 4,10" fill="#064E3B"/>
  <line x1="3.5" y1="14" x2="${w - 3.5}" y2="14" stroke="#FBBF24" stroke-width="1.1"/>
  <text x="${mid}" y="11.2" text-anchor="middle" font-family="${fontStack}" font-size="7.2" font-weight="800" letter-spacing="0.8" fill="#FDE68A">${hdrText}</text>
  <text x="${mid}" y="30" text-anchor="middle" font-family="${fontStack}" font-size="${charCount > 4 ? 11.5 : 13}" font-weight="900" letter-spacing="0.4" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // INDIA — State Highway Emerald-Top Milestone Shield
    // =========================================================================
    case 'IN_SH': {
      const hdrText = safeHeader || 'SH';
      const w = Math.max(46, Math.max(26 + charCount * 9, 18 + hdrText.length * 6.5));
      const h = 42;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M4,15 C4,6 ${mid - 12},2 ${mid},2 C${mid + 12},2 ${w - 4},6 ${w - 4},15 L${w - 4},33 C${w - 4},37 ${w - 7},39 ${w - 10},39 L10,39 C7,39 4,37 4,33 Z" fill="#FFFFFF" stroke="${haloStroke}" stroke-width="2.8"/>
  <path d="M4,15 C4,6 ${mid - 12},2 ${mid},2 C${mid + 12},2 ${w - 4},6 ${w - 4},15 L${w - 4},33 C${w - 4},37 ${w - 7},39 ${w - 10},39 L10,39 C7,39 4,37 4,33 Z" fill="#FFFFFF" stroke="#14532D" stroke-width="1.6"/>
  <path d="M4.8,16 C4.8,7.2 ${mid - 11},2.8 ${mid},2.8 C${mid + 11},2.8 ${w - 4.8},7.2 ${w - 4.8},16 L4.8,16 Z" fill="#15803D"/>
  <line x1="4.8" y1="16" x2="${w - 4.8}" y2="16" stroke="#14532D" stroke-width="1.2"/>
  <text x="${mid}" y="12.5" text-anchor="middle" font-family="${fontStack}" font-size="7.8" font-weight="800" fill="#FFFFFF">${hdrText}</text>
  <text x="${mid}" y="31.5" text-anchor="middle" font-family="${fontStack}" font-size="13" font-weight="900" fill="#0F172A">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `${header || 'SH'} ${code}` };
    }

    case 'IN_MDR': {
      const hdrText = safeHeader || 'MDR';
      const w = Math.max(44, 24 + charCount * 8.5);
      const h = 34;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" fill="#FFFFFF" stroke="#334155" stroke-width="1.6"/>
  <path d="M2.8,8 Q2.8,2.8 8,2.8 L${w - 8},2.8 Q${w - 2.8},2.8 ${w - 2.8},8 L${w - 2.8},13 L2.8,13 Z" fill="#3B82F6"/>
  <text x="${mid}" y="10.4" text-anchor="middle" font-family="${fontStack}" font-size="7.2" font-weight="800" fill="#FFFFFF">${hdrText}</text>
  <text x="${mid}" y="26.2" text-anchor="middle" font-family="${fontStack}" font-size="11.5" font-weight="800" fill="#0F172A">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `${header || 'MDR'} ${code}` };
    }

    // =========================================================================
    // UNITED STATES — Interstate Curved Three-Peak Red/Blue Escutcheon
    // =========================================================================
    case 'US_I': {
      const w = Math.max(46, 26 + charCount * 9.5);
      const h = 42;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M5,4 Q${mid / 2 + 2},8 ${mid},4 Q${mid + mid / 2 - 2},8 ${w - 5},4 C${w - 2},15 ${w - 4},31 ${mid},40 C4,31 2,15 5,4 Z" fill="#1D4ED8" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M5.6,4.8 Q${mid / 2 + 2},8.5 ${mid},4.8 Q${mid + mid / 2 - 2},8.5 ${w - 5.6},4.8 L${w - 4.4},14.5 L4.4,14.5 Z" fill="#DC2626"/>
  <line x1="4.2" y1="14.5" x2="${w - 4.2}" y2="14.5" stroke="#FFFFFF" stroke-width="1.4"/>
  <text x="${mid}" y="11.8" text-anchor="middle" font-family="${fontStack}" font-size="5.6" font-weight="800" letter-spacing="0.5" fill="#FFFFFF">INTERSTATE</text>
  <text x="${mid}" y="30.2" text-anchor="middle" font-family="${fontStack}" font-size="${charCount > 3 ? 12 : 14}" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `I-${code}` };
    }

    // =========================================================================
    // UNITED STATES — US Numbered Highway Scalloped White-on-Black Escutcheon
    // =========================================================================
    case 'US_US': {
      const w = Math.max(46, 26 + charCount * 9);
      const h = 40;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="5" fill="#111827" stroke="#FFFFFF" stroke-width="1.6"/>
  <path d="M6,5 Q${mid / 2 + 2},8 ${mid},5 Q${mid + mid / 2 - 2},8 ${w - 6},5 L${w - 4.5},11 Q${w - 7},16 ${w - 5},23 C${w - 5},31 ${mid + 6},35 ${mid},36.5 C${mid - 6},35 5,31 5,23 Q7,16 4.5,11 Z" fill="#FFFFFF"/>
  <text x="${mid}" y="13.8" text-anchor="middle" font-family="${fontStack}" font-size="7.5" font-weight="800" fill="#111827">US</text>
  <text x="${mid}" y="29.5" text-anchor="middle" font-family="${fontStack}" font-size="${charCount > 3 ? 12 : 13.8}" font-weight="900" fill="#111827">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `US ${code}` };
    }

    // =========================================================================
    // UNITED STATES — State Route Medallion
    // =========================================================================
    case 'US_SR': {
      const w = Math.max(42, 24 + charCount * 8.5);
      const h = 38;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" fill="#111827" stroke="#FFFFFF" stroke-width="1.5"/>
  <ellipse cx="${mid}" cy="${h / 2}" rx="${w / 2 - 4.5}" ry="${h / 2 - 4}" fill="#FFFFFF"/>
  ${safeHeader ? `<text x="${mid}" y="13.5" text-anchor="middle" font-family="${fontStack}" font-size="6.8" font-weight="800" fill="#334155">${safeHeader}</text>` : ''}
  <text x="${mid}" y="${safeHeader ? 26.8 : 23.5}" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#0F172A">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `${header || 'SR'} ${code}` };
    }

    // =========================================================================
    // CANADA — Trans-Canada & Provincial Crowned Shields
    // =========================================================================
    case 'CA_TCH':
    case 'CA_PROV': {
      const isTch = family === 'CA_TCH';
      const fill = isTch ? '#15803D' : '#FFFFFF';
      const fg = isTch ? '#FFFFFF' : '#0F172A';
      const border = isTch ? '#FFFFFF' : '#1E293B';
      const w = Math.max(44, 24 + charCount * 9);
      const h = 40;
      const mid = w / 2;
      const hdr = safeHeader || (isTch ? 'TCH' : 'CA');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M5,4 L${w - 5},4 L${w - 4},25 C${w - 4},33 ${mid + 6},37 ${mid},38.5 C${mid - 6},37 4,33 4,25 Z" fill="${fill}" stroke="${haloStroke}" stroke-width="2.5"/>
  <path d="M5,4 L${w - 5},4 L${w - 4},25 C${w - 4},33 ${mid + 6},37 ${mid},38.5 C${mid - 6},37 4,33 4,25 Z" fill="${fill}" stroke="${border}" stroke-width="1.6"/>
  <text x="${mid}" y="13.2" text-anchor="middle" font-family="${fontStack}" font-size="7.4" font-weight="800" fill="${fg}">${hdr}</text>
  <text x="${mid}" y="29" text-anchor="middle" font-family="${fontStack}" font-size="13" font-weight="900" fill="${fg}">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `${header || ''} ${code}`.trim() };
    }

    // =========================================================================
    // UNITED KINGDOM — Motorway (Blue), Primary A-Road (Green/Gold), B-Road
    // =========================================================================
    case 'GB_M':
    case 'GB_A':
    case 'GB_B': {
      const bg = family === 'GB_M' ? '#0072CE' : family === 'GB_A' ? '#006847' : '#FFFFFF';
      const fg = family === 'GB_M' ? '#FFFFFF' : family === 'GB_A' ? '#FFD200' : '#111827';
      const innerBorder = family === 'GB_B' ? '#111827' : '#FFFFFF';
      const w = Math.max(46, 18 + charCount * 9.5);
      const h = 30;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="5" fill="${bg}" stroke="${haloStroke}" stroke-width="2.4"/>
  <rect x="3.2" y="3.2" width="${w - 6.4}" height="${h - 6.4}" rx="3.5" fill="${bg}" stroke="${innerBorder}" stroke-width="1.4"/>
  <text x="${w / 2}" y="20" text-anchor="middle" font-family="${fontStack}" font-size="13" font-weight="900" letter-spacing="0.3" fill="${fg}">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // GERMANY — Bundesautobahn Six-Pointed Blue Hexagon & Bundesstraße Gold Plate
    // =========================================================================
    case 'DE_A': {
      const w = Math.max(52, 22 + charCount * 9);
      const h = 30;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <polygon points="8,3 ${mid},1.5 ${w - 8},3 ${w - 2},15 ${w - 8},27 ${mid},28.5 8,27 2,15" fill="#155EEF" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>
  <polygon points="9.5,5 ${mid},3.8 ${w - 9.5},5 ${w - 4.5},15 ${w - 9.5},25 ${mid},26.2 9.5,25 4.5,15" fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-linejoin="round"/>
  <text x="${mid}" y="19.6" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    case 'DE_B': {
      const w = Math.max(46, 20 + charCount * 9);
      const h = 28;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="4" fill="#FACC15" stroke="#111827" stroke-width="1.8"/>
  <rect x="3.6" y="3.6" width="${w - 7.2}" height="${h - 7.2}" rx="2.5" fill="none" stroke="#111827" stroke-width="1.2"/>
  <text x="${w / 2}" y="18.8" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#111827">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // FRANCE — Autoroute & Route Nationale Crimson Cartouche
    // =========================================================================
    case 'FR_A':
    case 'FR_N': {
      const w = Math.max(46, 20 + charCount * 9);
      const h = 28;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="4.5" fill="#DC2626" stroke="#FFFFFF" stroke-width="2"/>
  <text x="${w / 2}" y="19" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // INTERNATIONAL — Asian Highway (UNESCAP Cobalt) & European E-Road (UNECE Green)
    // =========================================================================
    case 'INT_AH':
    case 'INT_E': {
      const isAh = family === 'INT_AH';
      const bg = isAh ? '#1E3A8A' : '#16A34A';
      const innerStroke = isAh ? '#FDE68A' : '#FFFFFF';
      const w = Math.max(48, 18 + charCount * 9);
      const h = 28;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="4.5" fill="${bg}" stroke="${haloStroke}" stroke-width="2.2"/>
  <rect x="3.3" y="3.3" width="${w - 6.6}" height="${h - 6.6}" rx="3" fill="none" stroke="${innerStroke}" stroke-width="1.3"/>
  <text x="${w / 2}" y="18.8" text-anchor="middle" font-family="${fontStack}" font-size="12" font-weight="900" letter-spacing="0.4" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // JAPAN — National Route "Onigiri" Rounded Inverted Blue Triangle & Expressway
    // =========================================================================
    case 'JP_R': {
      const w = 44;
      const h = 40;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M8,5 L36,5 Q42,5 39,12 L25.5,35 Q22,40 18.5,35 L5,12 Q2,5 8,5 Z" fill="#1D4ED8" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/>
  <text x="22" y="12.5" text-anchor="middle" font-family="${fontStack}" font-size="5.6" font-weight="800" fill="#DBEAFE">ROUTE</text>
  <text x="22" y="25.5" text-anchor="middle" font-family="${fontStack}" font-size="${charCount >= 3 ? 11 : 13}" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: `Route ${code}` };
    }

    case 'JP_E': {
      const w = Math.max(44, 20 + charCount * 9);
      const h = 28;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="5" fill="#047857" stroke="#FFFFFF" stroke-width="2"/>
  <text x="${w / 2}" y="19" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // SOUTH AFRICA — Iconic 5-Sided Blue National Route Pentagon
    // =========================================================================
    case 'ZA_N':
    case 'ZA_R': {
      const w = 46;
      const h = 40;
      const mid = w / 2;
      const strokeAccent = family === 'ZA_N' ? '#FACC15' : '#FFFFFF';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <polygon points="${mid},2.5 ${w - 3},14 ${w - 8},37 8,37 3,14" fill="#1E40AF" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>
  <polygon points="${mid},5 ${w - 5.5},15 ${w - 9.8},34.5 9.8,34.5 5.5,15" fill="none" stroke="${strokeAccent}" stroke-width="1.2" stroke-linejoin="round"/>
  <text x="${mid}" y="27.5" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // MALAYSIA — Iconic Golden-Yellow 6-Sided Highway Hexagon
    // =========================================================================
    case 'MY_E':
    case 'MY_FT': {
      const w = Math.max(48, 22 + charCount * 9);
      const h = 36;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <polygon points="11,2.5 ${w - 11},2.5 ${w - 2.5},18 ${w - 11},33.5 11,33.5 2.5,18" fill="#FACC15" stroke="#111827" stroke-width="2.2" stroke-linejoin="round"/>
  <polygon points="12.5,5 ${w - 12.5},5 ${w - 5.2},18 ${w - 12.5},31 12.5,31 5.2,18" fill="none" stroke="#111827" stroke-width="1.1" stroke-linejoin="round"/>
  <text x="${mid}" y="22.5" text-anchor="middle" font-family="${fontStack}" font-size="12.5" font-weight="900" fill="#111827">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // AUSTRALIA, BRAZIL, CHINA, INDONESIA, PAKISTAN, BANGLADESH, NEPAL
    // =========================================================================
    case 'AU_M':
    case 'AU_A':
    case 'AU_NAT': {
      const w = Math.max(44, 22 + charCount * 9);
      const h = 36;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M4,4 L${w - 4},4 L${w - 4},22 C${w - 4},29 ${mid + 5},33 ${mid},34 C${mid - 5},33 4,29 4,22 Z" fill="#14532D" stroke="#FACC15" stroke-width="2.2"/>
  <text x="${mid}" y="23.5" text-anchor="middle" font-family="${fontStack}" font-size="13" font-weight="900" fill="#FACC15">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    case 'CN_G':
    case 'CN_NAT': {
      const isExp = family === 'CN_G';
      const bodyBg = isExp ? '#15803D' : '#B91C1C';
      const topBar = isExp ? '#DC2626' : '#FEF08A';
      const topFg = isExp ? '#FFFFFF' : '#7F1D1D';
      const w = Math.max(46, 22 + charCount * 8.5);
      const h = 36;
      const mid = w / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="5" fill="${bodyBg}" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M3,7 Q3,3 7,3 L${w - 7},3 Q${w - 3},3 ${w - 3},7 L${w - 3},12 L3,12 Z" fill="${topBar}"/>
  <text x="${mid}" y="9.8" text-anchor="middle" font-family="${fontStack}" font-size="6.4" font-weight="800" fill="${topFg}">${isExp ? 'EXPWY' : 'CN NAT'}</text>
  <text x="${mid}" y="27.2" text-anchor="middle" font-family="${fontStack}" font-size="12" font-weight="900" fill="#FFFFFF">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    case 'BR_FED':
    case 'BR_STATE':
    case 'ID_TOLL':
    case 'ID_NAS':
    case 'PK_M':
    case 'PK_N':
    case 'BD_N':
    case 'BD_R':
    case 'NP_H':
    case 'NP_F': {
      const hdrMap: Partial<Record<ShieldFamily, { hdr: string; topBg: string; bodyBg: string; fg: string }>> = {
        BR_FED: { hdr: safeHeader || 'BR', topBg: '#15803D', bodyBg: '#FFFFFF', fg: '#0F172A' },
        BR_STATE: { hdr: safeHeader || 'EST', topBg: '#1D4ED8', bodyBg: '#FFFFFF', fg: '#0F172A' },
        ID_TOLL: { hdr: 'TOL', topBg: '#FACC15', bodyBg: '#15803D', fg: '#FFFFFF' },
        ID_NAS: { hdr: 'NASIONAL', topBg: '#DC2626', bodyBg: '#FFFFFF', fg: '#0F172A' },
        PK_M: { hdr: 'MOTORWAY', topBg: '#065F46', bodyBg: '#047857', fg: '#FFFFFF' },
        PK_N: { hdr: 'NATIONAL', topBg: '#1E3A8A', bodyBg: '#1D4ED8', fg: '#FFFFFF' },
        BD_N: { hdr: 'BD NAT', topBg: '#DC2626', bodyBg: '#15803D', fg: '#FFFFFF' },
        BD_R: { hdr: 'REGIONAL', topBg: '#D97706', bodyBg: '#FFFFFF', fg: '#0F172A' },
        NP_H: { hdr: 'NEPAL', topBg: '#DC2626', bodyBg: '#1E3A8A', fg: '#FFFFFF' },
        NP_F: { hdr: 'FEEDER', topBg: '#334155', bodyBg: '#FFFFFF', fg: '#0F172A' },
      };
      const cfg = hdrMap[family]!;
      const w = Math.max(46, 22 + charCount * 8.5);
      const h = 38;
      const mid = w / 2;
      const topTextFill = family === 'ID_TOLL' ? '#111827' : '#FFFFFF';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M4,4 L${w - 4},4 L${w - 4},25 C${w - 4},31 ${mid + 6},35 ${mid},36 C${mid - 6},35 4,31 4,25 Z" fill="${cfg.bodyBg}" stroke="#1E293B" stroke-width="1.8"/>
  <rect x="4.8" y="4.8" width="${w - 9.6}" height="9.5" fill="${cfg.topBg}"/>
  <text x="${mid}" y="11.8" text-anchor="middle" font-family="${fontStack}" font-size="6.4" font-weight="800" fill="${topTextFill}">${cfg.hdr}</text>
  <text x="${mid}" y="27.5" text-anchor="middle" font-family="${fontStack}" font-size="12" font-weight="900" fill="${cfg.fg}">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: code };
    }

    // =========================================================================
    // TOLL AUXILIARY BADGE & HEXA GENERIC FALLBACK SHIELD
    // =========================================================================
    case 'TOLL_BADGE': {
      const w = 42;
      const h = 22;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="9" fill="#FEF3C7" stroke="#D97706" stroke-width="1.6"/>
  <text x="${w / 2}" y="14.5" text-anchor="middle" font-family="${fontStack}" font-size="9" font-weight="900" letter-spacing="0.6" fill="#92400E">TOLL</text>
</svg>`;
      return { svg, width: w, height: h, family, displayRef: 'TOLL' };
    }

    case 'GENERIC_HEXA':
    default: {
      const w = Math.max(44, 20 + charCount * 8.5);
      const h = 28;
      const bg = theme === 'dark' ? '#1E293B' : '#FFFFFF';
      const fg = theme === 'dark' ? '#F8FAFC' : '#0F172A';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <polygon points="8,2 ${w - 8},2 ${w - 2},14 ${w - 8},26 8,26 2,14" fill="${bg}" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>
  <text x="${w / 2}" y="18.2" text-anchor="middle" font-family="${fontStack}" font-size="11.5" font-weight="800" fill="${fg}">${safeCode}</text>
</svg>`;
      return { svg, width: w, height: h, family: 'GENERIC_HEXA', displayRef: code };
    }
  }
}

/**
 * Render a shield directly from its deterministic MapLibre spriteId
 * (`shield:{family}:{header}:{code}:{theme}`). Falls back cleanly to GENERIC_HEXA.
 */
export function renderShieldBySpriteId(spriteId: string): RenderedShieldSvg {
  const parsed = parseShieldSpriteId(spriteId);
  if (!parsed) {
    return renderShieldSvg({ family: 'GENERIC_HEXA', code: '?' });
  }
  return renderShieldSvg(parsed);
}

/**
 * Convert an SVG shield string into a data URI suitable for `<img src>` or
 * offscreen 2x Retina Canvas rasterization into MapLibre's WebGL sprite atlas.
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
