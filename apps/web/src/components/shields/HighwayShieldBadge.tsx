'use client';

import React, { useMemo } from 'react';
import {
  renderShieldBySpriteId,
  renderShieldSvg,
  svgToDataUrl,
  type ShieldFamily,
} from '@hexa/shields';
import type { RouteShieldBadge } from '@hexa/shared';

export interface HighwayShieldBadgeProps {
  badge?: RouteShieldBadge;
  spriteId?: string;
  family?: ShieldFamily;
  code?: string;
  header?: string;
  theme?: 'light' | 'dark';
  scale?: number;
  className?: string;
}

export function HighwayShieldBadge({
  badge,
  spriteId,
  family,
  code,
  header,
  theme = 'light',
  scale = 0.82,
  className = '',
}: HighwayShieldBadgeProps) {
  const rendered = useMemo(() => {
    if (spriteId) {
      return renderShieldBySpriteId(spriteId);
    }
    if (badge) {
      if (badge.id && badge.id.startsWith('shield:')) {
        return renderShieldBySpriteId(badge.id);
      }
      const [hdr, num] = badge.code.includes(':')
        ? badge.code.split(':')
        : [undefined, badge.code];
      return renderShieldSvg({
        family: badge.family as ShieldFamily,
        code: num || badge.displayRef,
        header: hdr,
        theme,
      });
    }
    if (family && code) {
      return renderShieldSvg({ family, code, header, theme });
    }
    return renderShieldSvg({ family: 'GENERIC_HEXA', code: '?', theme });
  }, [badge, spriteId, family, code, header, theme]);

  const dataUrl = useMemo(() => svgToDataUrl(rendered.svg), [rendered.svg]);
  const w = Math.round(rendered.width * scale);
  const h = Math.round(rendered.height * scale);
  const titleText = badge
    ? `${badge.displayRef}${badge.network ? ` (${badge.network})` : ''} • ${badge.confidence}`
    : rendered.displayRef;

  return (
    <img
      src={dataUrl}
      alt={rendered.displayRef}
      title={titleText}
      width={w}
      height={h}
      style={{ width: `${w}px`, height: `${h}px` }}
      className={`inline-block select-none align-middle drop-shadow-sm ${className}`}
    />
  );
}
