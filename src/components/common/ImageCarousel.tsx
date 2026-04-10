import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';

interface ImageCarouselProps {
  images: string[];
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function ImageCarousel({ images, height = 200, borderRadius = 12, style }: ImageCarouselProps) {
  const validImages = images.filter(Boolean);
  if (validImages.length === 0) return null;

  if (validImages.length === 1) {
    return <SingleImage uri={validImages[0]} height={height} borderRadius={borderRadius} style={style} />;
  }

  return <MultiCarousel images={validImages} height={height} borderRadius={borderRadius} style={style} />;
}

function SingleImage({ uri, height, borderRadius, style }: { uri: string; height: number; borderRadius: number; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={[{ marginTop: 10 }, style]}>
        <img
          src={uri}
          style={{ width: '100%', height, borderRadius, objectFit: 'cover', display: 'block' } as React.CSSProperties}
          alt=""
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={[{ marginTop: 10 }, style]}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height, borderRadius }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

function MultiCarousel({ images, height, borderRadius, style }: { images: string[]; height: number; borderRadius: number; style?: StyleProp<ViewStyle> }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (containerWidth === 0) return;
    const x = e.nativeEvent.contentOffset.x;
    setActiveIndex(Math.round(x / containerWidth));
  }

  const dots = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6, gap: 4 }}>
      {images.map((_, i) => (
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
      <View style={[{ marginTop: 10 }, style]}>
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            borderRadius,
            gap: 0,
            scrollbarWidth: 'none',
          } as React.CSSProperties}
          onScroll={(e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            setActiveIndex(Math.round(el.scrollLeft / el.offsetWidth));
          }}
        >
          {images.map((uri, i) => (
            <img
              key={i}
              src={uri}
              style={{
                minWidth: '100%',
                height,
                objectFit: 'cover',
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
    <View
      style={[{ marginTop: 10 }, style]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={{ borderRadius }}
        >
          {images.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={{ width: containerWidth, height, borderRadius }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      )}
      {dots}
    </View>
  );
}
