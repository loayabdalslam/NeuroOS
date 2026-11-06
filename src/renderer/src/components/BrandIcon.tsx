import { BRAND_ICONS } from './brandIcons';
import { TOOLKIT_BRAND, allBrands } from './brandCustom';
import type { BrandMark } from './brandIcons';

const MARKS = allBrands(BRAND_ICONS);

export interface BrandIconProps {
  brand?: string;
  toolkit?: string;
  size?: number;
  mono?: boolean;
  className?: string;
  title?: string;
}

function normalized(value?: string): string {
  return (value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

export function brandMark(brand?: string, toolkit?: string): BrandMark | undefined {
  if (toolkit) {
    const mapped = TOOLKIT_BRAND[normalized(toolkit)];
    if (mapped && MARKS[mapped]) return MARKS[mapped];
  }
  if (!brand) return undefined;
  const key = normalized(brand);
  return MARKS[key] ?? MARKS[TOOLKIT_BRAND[key] ?? ''] ?? undefined;
}

export function hasBrand(brand?: string, toolkit?: string): boolean {
  return Boolean(brandMark(brand, toolkit));
}

/** Keep very dark brand marks legible on dark surfaces. */
function readableColor(hex: string): string {
  const value = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(value)) return `#${hex}`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 62 ? '#dbe2ea' : `#${hex}`;
}

/** Renders an official brand path (simple-icons) or one of our custom marks. */
export function BrandIcon({ brand, toolkit, size = 18, mono, className, title }: BrandIconProps): JSX.Element | null {
  const mark = brandMark(brand, toolkit);
  if (!mark) return null;
  const color = mono ? 'currentColor' : readableColor(mark.hex);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: 'block', flex: 'none' }}
      role={title ? 'img' : undefined}
      aria-label={title ?? mark.title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={mark.path} fill={color} />
    </svg>
  );
}

export function brandColor(brand?: string, toolkit?: string): string | undefined {
  const mark = brandMark(brand, toolkit);
  return mark ? `#${mark.hex}` : undefined;
}
