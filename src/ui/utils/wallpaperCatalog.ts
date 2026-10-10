import type { BuiltInWallpaper } from './themeManager.ts';

export type WallpaperFamily = 'Nature' | 'Abstract' | 'Patterns';

export interface CuratedWallpaper {
  id: string;
  family: WallpaperFamily;
  name: string;
  description: string;
  patternClass: string;
  wallpaperId: BuiltInWallpaper;
}

export const WALLPAPER_CATALOG: CuratedWallpaper[] = [
  { id: 'misty-pines', family: 'Nature', name: 'Misty Pines', description: 'Soft forest layers in a cool morning haze', patternClass: 'veil-wallpaper-photo--misty-pines', wallpaperId: 'nature-misty-pines' },
  { id: 'desert-dusk', family: 'Nature', name: 'Desert Dusk', description: 'Warm sandstone shapes at the end of the day', patternClass: 'veil-wallpaper-photo--desert-dusk', wallpaperId: 'nature-desert-dusk' },
  { id: 'aurora-glow', family: 'Abstract', name: 'Aurora Glow', description: 'Muted indigo and teal light', patternClass: 'veil-wallpaper-photo--aurora-glow', wallpaperId: 'abstract-aurora-glow' },
  { id: 'rosewater', family: 'Abstract', name: 'Rosewater', description: 'Soft rose and lilac color fields', patternClass: 'veil-wallpaper-photo--rosewater', wallpaperId: 'abstract-rosewater' },
  { id: 'soft-grid', family: 'Patterns', name: 'Soft Grid', description: 'A subtle geometric grid', patternClass: 'veil-wallpaper-photo--soft-grid', wallpaperId: 'pattern-soft-grid' },
  { id: 'contours', family: 'Patterns', name: 'Contour Lines', description: 'Quiet topographic rings', patternClass: 'veil-wallpaper-photo--contours', wallpaperId: 'pattern-contours' },
];

export const WALLPAPER_FAMILIES: WallpaperFamily[] = ['Nature', 'Abstract', 'Patterns'];

export function getWallpapersForFamily(family: WallpaperFamily): CuratedWallpaper[] {
  return WALLPAPER_CATALOG.filter((wallpaper) => wallpaper.family === family);
}
