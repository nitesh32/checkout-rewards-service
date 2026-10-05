import {
  AudioLines,
  Camera,
  Headphones,
  Smartphone,
  Speaker,
  Watch,
  type LucideIcon,
} from 'lucide-react';

export type Category = 'Audio' | 'Phones' | 'Wearables' | 'Cameras';

export const CATEGORIES: readonly Category[] = ['Audio', 'Phones', 'Wearables', 'Cameras'];

interface ProductMedia {
  category: Category;
  icon: LucideIcon;
  alt: string;
}

/**
 * Frontend-only presentation data for the seeded products, keyed by SKU, so the API stays unchanged.
 * Products not listed here still render (as "Audio" with a generic placeholder).
 */
const MEDIA_BY_SKU: Record<string, ProductMedia> = {
  'SPEAKER-BT-BLK': {
    category: 'Audio',
    icon: Speaker,
    alt: 'Black portable Bluetooth speaker with a blue indicator light',
  },
  'EARBUDS-TWS-BLK': {
    category: 'Audio',
    icon: AudioLines,
    alt: 'Pair of black true wireless earbuds',
  },
  'HEADPHONES-OVR-BLK': {
    category: 'Audio',
    icon: Headphones,
    alt: 'Black wireless over-ear headphones',
  },
  'PHONE-PRO-BLU': {
    category: 'Phones',
    icon: Smartphone,
    alt: 'Smartphone on a wooden stand next to a smartwatch',
  },
  'WATCH-SMART-BLU': {
    category: 'Wearables',
    icon: Watch,
    alt: 'Smartwatch with a blue strap worn on a wrist',
  },
  'CAMERA-MIRRORLESS': { category: 'Cameras', icon: Camera, alt: 'Black mirrorless camera body' },
};

const FALLBACK_MEDIA: ProductMedia = { category: 'Audio', icon: AudioLines, alt: 'Product photo' };

// Photos live in src/assets/products as <sku>.webp (4:5) and optional <sku>@2x.webp. Bundling them
// (instead of fetching from /public) means a missing photo costs no failed request: the glob is
// simply empty for it and the placeholder renders.
const PHOTO_URLS = import.meta.glob<string>('../assets/products/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

function photoUrl(fileName: string): string | undefined {
  return PHOTO_URLS[`../assets/products/${fileName}.webp`];
}

export interface ProductMediaInfo extends ProductMedia {
  photo?: { src: string; src2x?: string };
}

export function getProductMedia(sku: string): ProductMediaInfo {
  const media = MEDIA_BY_SKU[sku] ?? FALLBACK_MEDIA;
  const src = photoUrl(sku);
  if (!src) return media;
  const src2x = photoUrl(`${sku}@2x`);
  return { ...media, photo: { src, ...(src2x ? { src2x } : {}) } };
}
