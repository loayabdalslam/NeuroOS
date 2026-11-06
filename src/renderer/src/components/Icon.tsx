import type { CSSProperties } from 'react';
import { SystemIcon, resolveGlyph } from './SystemIcon';

export type IconName = string;

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Kept for API compatibility with the previous Lucide-based icon set. */
  strokeWidth?: number;
  mono?: boolean;
  title?: string;
  role?: string;
  onClick?: () => void;
}

/**
 * The single icon entry point for the whole app. Feature icons are duotone and
 * coloured; utility icons are custom strokes. See SystemIcon.tsx for the set.
 */
export function Icon({ name, size = 16, className, style, mono, title, role, onClick }: IconProps): JSX.Element {
  return <SystemIcon name={name} size={size} className={className} style={style} mono={mono} title={title} role={role} onClick={onClick} />;
}

export function hasIcon(name: string): boolean {
  return Boolean(resolveGlyph(name));
}
