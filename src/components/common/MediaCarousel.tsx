import { Image } from 'expo-image';
import React, { useState } from 'react';
import { LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useIsItemVisible } from '@/components/media/VisibleItems';
import { VideoTile } from '@/components/media/VideoTile';
import { DrinkMedia, MEDIA_ASPECT, mediaAspect, orientationOf } from '@/lib/media';

interface MediaCarouselProps {
  media: DrinkMedia[];
  /** Tallest the frame may get; wider-than-allowed frames shrink and center. */
  maxHeight?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Key of the list row this carousel sits in; videos only autoplay while it's on screen. */
  visibilityKey?: string;
}

const FRAME_BG = '#0b0b0b';

/** Items matching the frame fill it exactly; anything else is letterboxed, never cropped. */
function fitFor(item: DrinkMedia, frameAspect: number): 'cover' | 'contain' {
  if (!item.width || !item.height) return 'cover'; // legacy photo with unknown size
  return Math.abs(mediaAspect(item) - frameAspect) < 0.02 ? 'cover' : 'contain';
}

/** The first item picks the frame (landscape or portrait), like Instagram. */
function frameAspectFor(first: DrinkMedia): number {
  if (!first.width || !first.height) return MEDIA_ASPECT.landscape;
  return MEDIA_ASPECT[orientationOf(first.width, first.height)];
}

export function MediaCarousel({ media, maxHeight = 520, borderRadius = 12, style, visibilityKey }: MediaCarouselProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const rowVisible = useIsItemVisible(visibilityKey);

  const items = media.filter((m) => m.url);
  if (items.length === 0) return null;

  const aspect = frameAspectFor(items[0]);
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
            <MediaItem item={items[0]} width={frameWidth} height={frameHeight} fit={fitFor(items[0], aspect)} borderRadius={borderRadius} visible={rowVisible} />
          ) : (
            <MultiCarousel items={items} width={frameWidth} height={frameHeight} aspect={aspect} borderRadius={borderRadius} visible={rowVisible} />
          )}
        </View>
      )}
    </View>
  );
}

function MediaItem({
  item,
  width,
  height,
  fit,
  borderRadius,
  visible = true,
}: {
  item: DrinkMedia;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  borderRadius: number;
  visible?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (item.type === 'video') {
    return (
      <VideoTile
        item={item}
        width={width}
        height={height}
        fit={fit}
        borderRadius={borderRadius}
        backgroundColor={FRAME_BG}
        visible={visible}
      />
    );
  }

  if (failed) return null;

  if (Platform.OS === 'web') {
    return (
      <img
        src={item.url}
        style={{ width, height, borderRadius, objectFit: fit, display: 'block', flexShrink: 0, backgroundColor: FRAME_BG } as React.CSSProperties}
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
  visible,
}: {
  items: DrinkMedia[];
  width: number;
  height: number;
  aspect: number;
  borderRadius: number;
  visible: boolean;
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

  const slides = items.map((item, i) => (
    <View key={i} style={Platform.OS === 'web' ? ({ scrollSnapAlign: 'start', flexShrink: 0 } as any) : undefined}>
      <MediaItem
        item={item}
        width={width}
        height={height}
        fit={fitFor(item, aspect)}
        borderRadius={borderRadius}
        visible={visible && i === activeIndex}
      />
    </View>
  ));

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
          {slides}
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
        {slides}
      </ScrollView>
      {dots}
    </View>
  );
}
