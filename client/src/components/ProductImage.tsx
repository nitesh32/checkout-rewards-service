import { useState } from 'react';
import { getProductMedia } from '@/lib/productMedia';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  sku: string;
  /** Desaturates the photo, used for sold-out products. */
  isMuted?: boolean;
  /** For photos visible on first load: fetched immediately and first, instead of lazily. */
  isPriority?: boolean;
  className?: string;
}

const WIDTH = 800;
const HEIGHT = 1000;

/** A 4:5 image well: the photo fades in over the muted background (priority photos appear at once), or a category icon stands in. */
export function ProductImage({
  sku,
  isMuted = false,
  isPriority = false,
  className,
}: ProductImageProps) {
  const { photo, icon: Icon, alt } = getProductMedia(sku);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <div className={cn('relative aspect-[4/5] overflow-hidden bg-muted', className)}>
      {photo && !hasFailed ? (
        <img
          src={photo.src}
          srcSet={photo.src2x ? `${photo.src} 1x, ${photo.src2x} 2x` : undefined}
          alt={alt}
          width={WIDTH}
          height={HEIGHT}
          loading={isPriority ? 'eager' : 'lazy'}
          fetchPriority={isPriority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setHasLoaded(true)}
          onError={() => setHasFailed(true)}
          className={cn(
            'size-full object-cover transition-[opacity,scale] duration-200 motion-safe:group-hover/open:scale-[1.03] motion-safe:group-hover/open:duration-300',
            // Priority photos skip the fade-in: an invisible image does not count as painted, so the
            // fade would delay the page's largest paint until JavaScript reacts to the load event.
            isPriority || hasLoaded ? 'opacity-100' : 'opacity-0',
            isMuted && 'saturate-[0.6]',
          )}
        />
      ) : (
        <div role="img" aria-label={alt} className="flex size-full items-center justify-center">
          <Icon className="size-10 text-foreground opacity-30" strokeWidth={1.25} aria-hidden />
        </div>
      )}
    </div>
  );
}
