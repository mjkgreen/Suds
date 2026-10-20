import { Image } from 'expo-image';
import React, { useState } from 'react';
import { LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { DrinkMedia, mediaAspect } from '@/lib/media';

interface ImageCarouselProps {
  media: DrinkMedia[];
  /** Tallest the frame may get; wider-than-allowed frames shrink and center. */
  maxHeight?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const FRAME_BG = '#0b0b0b';

/** Cropped items fill their frame exactly; anything else is letterboxed, never cropped. */
function fitFor(item: DrinkMedia, frameAspect: number): 'cover' | 'contain' {
  if (!item.width || !item.height) return 'cover'; // legacy photo with unknown size
  return Math.abs(mediaAspect(item) - frameAspect) < 0.02 ? 'cover' : 'contain';
}

export function ImageCarousel({ media, maxHeight = 520, borderRadius = 12, style }: ImageCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  // Video playback isn't supported yet; only images are rendered.
  const items = media.filter((m) => m.url && m.type === 'image');
  if (items.length === 0) return null;

  // The first item sets the frame, like Instagram.
  const aspect = mediaAspect(items[0]);
  const frameWidth = Math.min(containerWidth, maxHeight * aspect);
  const frameHeight = frameWidth / aspect;

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View style={[{ marginTop: 10 }, style]} onLayout={handleLayout}>
      {containerWidth > 0 && (
        <View style={{ width: frameWidth, alignSelf: 'center' }}>
          {items.length === 1 ? (
            <SingleImage item={items[0]} width={frameWidth} height={frameHeight} fit={fitFor(items[0], aspect)} borderRadius={borderRadius} />
          ) : (
            <MultiCarousel items={items} width={frameWidth} height={frameHeight} aspect={aspect} borderRadius={borderRadius} />
          )}
        </View>
      )}
    </View>
  );
}

function SingleImage({
  item,
  width,
  height,
  fit,
  borderRadius,
}: {
  item: DrinkMedia;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  borderRadius: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  if (Platform.OS === 'web') {
    return (
      <img
        src={item.url}
        style={{ width, height, borderRadius, objectFit: fit, display: 'block', backgroundColor: FRAME_BG } as React.CSSProperties}
        alt=""
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      source={{ uri: item.url }}
      style={{ width, height, borderRadius, backgroundColor: FRAME_BG }}
      contentFit={fit}
      onError={() => setFailed(true)}
    />
  );
}

function MultiCarousel({
  items,
  width,
  height,
  aspect,
  borderRadius,
}: {
  items: DrinkMedia[];
  width: number;
  height: number;
  aspect: number;
  borderRadius: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    setActiveIndex(Math.round(x / width));
  }

  const dots = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6, gap: 4 }}>
      {items.map((_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 16 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? '#f59e0b' : '#9ca3af',
          }}
        />
      ))}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View>
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            borderRadius,
            gap: 0,
            scrollbarWidth: 'none',
            width,
          } as React.CSSProperties}
          onScroll={(e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            setActiveIndex(Math.round(el.scrollLeft / el.offsetWidth));
          }}
        >
          {items.map((item, i) => (
            <img
              key={i}
              src={item.url}
              style={{
                minWidth: '100%',
                height,
                objectFit: fitFor(item, aspect),
                backgroundColor: FRAME_BG,
                borderRadius,
                scrollSnapAlign: 'start',
                flexShrink: 0,
                display: 'block',
              } as React.CSSProperties}
              alt=""
            />
          ))}
        </div>
        {dots}
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ borderRadius, width }}
      >
        {items.map((item, i) => (
          <Image
            key={i}
            source={{ uri: item.url }}
            style={{ width, height, borderRadius, backgroundColor: FRAME_BG }}
            contentFit={fitFor(item, aspect)}
          />
        ))}
      </ScrollView>
      {dots}
    </View>
  );
}
