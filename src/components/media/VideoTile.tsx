import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DrinkMedia, formatClipLength } from '@/lib/media';
import { usePrefsStore } from '@/stores/prefsStore';

interface VideoTileProps {
  item: DrinkMedia;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  borderRadius: number;
  backgroundColor: string;
  /** False when off-screen or swiped away in a carousel; stops playback. */
  visible?: boolean;
}

/**
 * A video in the feed. While on screen it autoplays muted and looped (unless
 * the user turned autoplay off); tapping it switches to full playback with
 * sound and controls. The player only exists while the video is on screen,
 * so a feed full of videos stays cheap.
 */
export function VideoTile({ item, width, height, fit, borderRadius, backgroundColor, visible = true }: VideoTileProps) {
  const autoplayVideos = usePrefsStore((s) => s.autoplayVideos);
  const focused = useScreenFocused();
  const onScreen = visible && focused;

  // Set when the user taps play: sound on, native controls shown.
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    if (!onScreen) setEngaged(false);
  }, [onScreen]);

  const autoplaying = onScreen && autoplayVideos && !engaged;
  const showPlayer = engaged || autoplaying;

  const frame = { width, height, borderRadius, backgroundColor, overflow: 'hidden' as const };

  if (engaged) {
    return (
      // Claim touches so taps on the player controls don't open the parent card.
      <View style={frame} onStartShouldSetResponder={() => true}>
        <InlinePlayer url={item.url} width={width} height={height} fit={fit} muted={false} />
      </View>
    );
  }

  return (
    <Pressable
      style={frame}
      onPress={(e) => {
        e.stopPropagation();
        setEngaged(true);
      }}
      accessibilityRole="button"
      accessibilityLabel="Play video"
    >
      {item.poster_url ? (
        <Image source={{ uri: item.poster_url }} style={{ position: 'absolute', width, height }} contentFit={fit} />
      ) : null}
      {showPlayer ? (
        // pointerEvents none so the tap reaches the Pressable, not the video.
        <View pointerEvents="none" style={{ width, height }}>
          <InlinePlayer url={item.url} width={width} height={height} fit={fit} muted />
        </View>
      ) : (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any}>
          <View className="bg-black/50 rounded-full items-center justify-center" style={{ width: 56, height: 56 }}>
            <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        </View>
      )}
      <View className="absolute bottom-2 right-2 flex-row items-center gap-1.5">
        {autoplaying && (
          <View className="bg-black/60 rounded-full p-1">
            <Ionicons name="volume-mute" size={12} color="#fff" />
          </View>
        )}
        {item.duration ? (
          <View className="bg-black/60 rounded-full px-2 py-0.5">
            <Text className="text-white text-xs font-semibold">{formatClipLength(item.duration)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** False while another screen is pushed on top of this one. */
function useScreenFocused() {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

function InlinePlayer({
  url,
  width,
  height,
  fit,
  muted,
}: {
  url: string;
  width: number;
  height: number;
  fit: 'cover' | 'contain';
  /** Muted players are the autoplay preview: looped, no controls. */
  muted: boolean;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = muted;
    p.loop = muted;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit={fit}
      nativeControls={!muted}
      allowsPictureInPicture={false}
    />
  );
}
