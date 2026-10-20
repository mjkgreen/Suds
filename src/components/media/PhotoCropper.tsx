import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocalMedia, MAX_IMAGE_EDGE, MEDIA_ASPECT, MediaOrientation, orientationOf } from '@/lib/media';

const MAX_ZOOM = 5;

interface PhotoCropperProps {
  /** Local URI of the picked photo. Null hides the cropper. */
  uri: string | null;
  onCancel: () => void;
  onDone: (media: LocalMedia) => void;
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Full-screen cropper: the user picks landscape or portrait, then drags and
 * pinches the photo inside that fixed frame. What's inside the frame is what
 * gets uploaded.
 */
export function PhotoCropper({ uri, onCancel, onDone }: PhotoCropperProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Real (EXIF-corrected) pixel size of the source image.
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  const [orientation, setOrientation] = useState<MediaOrientation>('landscape');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  useEffect(() => {
    setSource(null);
    setError(null);
    if (!uri) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = await ImageManipulator.manipulate(uri).renderAsync();
        if (cancelled) return;
        setSource({ width: ref.width, height: ref.height });
        setOrientation(orientationOf(ref.width, ref.height));
        ref.release();
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Could not load photo.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  // Reset the view whenever the frame or photo changes.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [orientation, source]);

  const aspect = MEDIA_ASPECT[orientation];
  const maxFrameW = Math.min(screenW - 32, 560);
  const maxFrameH = screenH - insets.top - insets.bottom - 240;
  const frameW = Math.min(maxFrameW, maxFrameH * aspect);
  const frameH = frameW / aspect;

  // Size of the image at zoom 1: just large enough to cover the frame.
  const baseScale = source ? Math.max(frameW / source.width, frameH / source.height) : 1;
  const baseW = source ? source.width * baseScale : frameW;
  const baseH = source ? source.height * baseScale : frameH;

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const maxX = (baseW * scale.value - frameW) / 2;
      const maxY = (baseH * scale.value - frameH) / 2;
      tx.value = clamp(savedTx.value + e.translationX, -maxX, maxX);
      ty.value = clamp(savedTy.value + e.translationY, -maxY, maxY);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_ZOOM);
      const maxX = (baseW * scale.value - frameW) / 2;
      const maxY = (baseH * scale.value - frameH) / 2;
      tx.value = clamp(tx.value, -maxX, maxX);
      ty.value = clamp(ty.value, -maxY, maxY);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  function zoomBy(factor: number) {
    const next = clamp(scale.value * factor, 1, MAX_ZOOM);
    const maxX = (baseW * next - frameW) / 2;
    const maxY = (baseH * next - frameH) / 2;
    scale.value = next;
    tx.value = clamp(tx.value, -maxX, maxX);
    ty.value = clamp(ty.value, -maxY, maxY);
  }

  async function handleDone() {
    if (!uri || !source) return;
    setSaving(true);
    setError(null);
    try {
      // Map the frame back into source-image pixels.
      const total = baseScale * scale.value;
      const cropW = Math.min(source.width, frameW / total);
      const cropH = Math.min(source.height, frameH / total);
      const centerX = source.width / 2 - tx.value / total;
      const centerY = source.height / 2 - ty.value / total;
      const originX = clamp(Math.round(centerX - cropW / 2), 0, source.width - Math.round(cropW));
      const originY = clamp(Math.round(centerY - cropH / 2), 0, source.height - Math.round(cropH));

      const ctx = ImageManipulator.manipulate(uri).crop({
        originX,
        originY,
        width: Math.round(cropW),
        height: Math.round(cropH),
      });
      const longEdge = Math.max(cropW, cropH);
      if (longEdge > MAX_IMAGE_EDGE) {
        ctx.resize(cropW >= cropH ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
      }
      const ref = await ctx.renderAsync();
      const result = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      ref.release();

      onDone({
        uri: result.uri,
        type: 'image',
        width: result.width,
        height: result.height,
        mimeType: 'image/jpeg',
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not crop photo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen">
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={onCancel} hitSlop={8} disabled={saving}>
              <Text className="text-white text-base">Cancel</Text>
            </Pressable>
            <Text className="text-white text-base font-semibold">Crop Photo</Text>
            <Pressable onPress={handleDone} hitSlop={8} disabled={!source || saving}>
              {saving ? (
                <ActivityIndicator color="#f59e0b" />
              ) : (
                <Text className="text-primary text-base font-bold" style={{ opacity: source ? 1 : 0.4 }}>
                  Done
                </Text>
              )}
            </Pressable>
          </View>

          {/* Crop frame */}
          <View className="flex-1 items-center justify-center">
            {source ? (
              <GestureDetector gesture={gesture}>
                <View style={{ width: frameW, height: frameH, overflow: 'hidden', backgroundColor: '#111' }}>
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: baseW,
                        height: baseH,
                        left: (frameW - baseW) / 2,
                        top: (frameH - baseH) / 2,
                      },
                      imageStyle,
                    ]}
                  >
                    <Image source={{ uri: uri! }} style={{ width: '100%', height: '100%' }} contentFit="fill" />
                  </Animated.View>
                  {/* Rule-of-thirds guide */}
                  <View pointerEvents="none" style={{ position: 'absolute', inset: 0 } as any}>
                    {[1, 2].map((i) => (
                      <React.Fragment key={i}>
                        <View style={{ position: 'absolute', left: (frameW * i) / 3, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                        <View style={{ position: 'absolute', top: (frameH * i) / 3, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </GestureDetector>
            ) : error ? null : (
              <ActivityIndicator color="#f59e0b" />
            )}
            {error && <Text className="text-red-400 text-sm mt-4 px-6 text-center">{error}</Text>}
          </View>

          {/* Controls */}
          <View className="items-center pb-4 gap-4">
            <Text className="text-white/60 text-xs">
              {Platform.OS === 'web' ? 'Drag to reposition' : 'Drag and pinch to adjust · double-tap to reset'}
            </Text>
            <View className="flex-row items-center gap-3">
              {(['landscape', 'portrait'] as const).map((o) => {
                const active = orientation === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => setOrientation(o)}
                    disabled={saving}
                    className={`flex-row items-center gap-2 px-4 py-2 rounded-full ${active ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <View
                      style={{
                        width: o === 'landscape' ? 18 : 12,
                        height: o === 'landscape' ? 12 : 16,
                        borderWidth: 2,
                        borderRadius: 2,
                        borderColor: active ? '#000' : '#fff',
                      }}
                    />
                    <Text className={`text-sm font-semibold ${active ? 'text-black' : 'text-white'}`}>
                      {o === 'landscape' ? 'Landscape' : 'Portrait'}
                    </Text>
                  </Pressable>
                );
              })}
              {Platform.OS === 'web' && (
                <>
                  <Pressable onPress={() => zoomBy(1 / 1.25)} className="bg-white/10 rounded-full p-2">
                    <Ionicons name="remove" size={18} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => zoomBy(1.25)} className="bg-white/10 rounded-full p-2">
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
