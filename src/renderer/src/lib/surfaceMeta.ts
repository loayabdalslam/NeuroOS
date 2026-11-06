import type { SurfaceKind } from '@shared/types';
import { SURFACES } from '../surfaces/meta';

export const iconForSurface = (surface: SurfaceKind): string => SURFACES[surface].icon;
export const labelKeyForSurface = (surface: SurfaceKind): string => SURFACES[surface].labelKey;
export const accentForSurface = (surface: SurfaceKind): string => SURFACES[surface].accent;
