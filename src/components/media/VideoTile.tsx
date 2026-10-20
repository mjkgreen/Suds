import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DrinkMedia, formatClipLength } from '@/lib/media';

interface VideoTileProps {
  item: DrinkMedia;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  borderRadius: number;
  backgroundColor: string;
  /** False when swiped off-screen in a carousel; stops playback. */
  active?: boolean;
}

/**
 * Shows a video's poster with a play button; the player is only created once
 * the user taps play, so a feed full of videos stays cheap.
 */
export function VideoTile({ item, width, height, fit, borderRadius, backgroundColor, active = true }: VideoTileProps) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);

  const frame = { width, height, borderRadius, backgroundColor, overflow: 'hidden' as const };

  if (playing) {
    return (
      // Claim touches so taps on the player controls don't open the parent card.
      <View style={frame} onStartShouldSetResponder={() => true}>
        <InlinePlayer url={item.url} width={width} height={height} fit={fit} />
      </View>
    );
  }

  return (
    <Pressable
      style={frame}
      onPress={(e) => {
        e.stopPropagation();
        setPlaying(true);
      }}
      accessibilityRole="button"
      accessibilityLabel="Play video"
    >
      {item.poster_url ? (
        <Image source={{ uri: item.poster_url }} style={{ width, height }} contentFit={fit} />
      ) : null}
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any}>
        <View className="bg-black/50 rounded-full items-center justify-center" style={{ width: 56, height: 56 }}>
          <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
        </View>
      </View>
      {item.duration ? (
        <View className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5">
          <Text className="text-white text-xs font-semibold">{formatClipLength(item.duration)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function InlinePlayer({ url, width, height, fit }: { url: string; width: number; height: number; fit: 'cover' | 'contain' }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit={fit}
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}
