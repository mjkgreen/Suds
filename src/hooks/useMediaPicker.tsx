import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { PhotoCropper } from '@/components/media/PhotoCropper';
import { LocalMedia, MAX_UPLOAD_BYTES, MAX_VIDEO_SECONDS } from '@/lib/media';
import { createVideoPoster } from '@/lib/videoPoster';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/**
 * Picks photos and videos for a drink log. Photos go through the cropper;
 * videos are checked for length/size and get a poster frame.
 * Render `cropper` somewhere in the screen; `onPicked` fires with each
 * finished item.
 */
export function useMediaPicker(onPicked: (media: LocalMedia) => void) {
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleVideo(asset: ImagePicker.ImagePickerAsset) {
    const seconds = asset.duration != null ? asset.duration / 1000 : null;
    if (seconds != null && seconds > MAX_VIDEO_SECONDS + 0.5) {
      notify('Video too long', `Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it in Photos and try again.`);
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      notify('Video too large', 'Videos must be under 50 MB. Try a shorter clip.');
      return;
    }

    setProcessing(true);
    try {
      let poster: { uri: string; width: number; height: number } | null = null;
      try {
        poster = await createVideoPoster(asset.uri);
      } catch {
        // No poster — fall back to the picker's reported size.
      }
      onPicked({
        uri: asset.uri,
        type: 'video',
        width: poster?.width ?? asset.width,
        height: poster?.height ?? asset.height,
        mimeType: asset.mimeType ?? null,
        posterUri: poster?.uri ?? null,
        duration: seconds,
      });
    } finally {
      setProcessing(false);
    }
  }

  async function launch(source: 'library' | 'photo' | 'video') {
    if (source !== 'library') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    }

    // No native editing — the native iOS editor only crops square, so photo
    // cropping happens in our own cropper.
    const result =
      source === 'library'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsEditing: false,
            quality: 1,
          })
        : source === 'photo'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ['videos'],
              videoMaxDuration: MAX_VIDEO_SECONDS,
              videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
            });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.type === 'video') await handleVideo(asset);
    else setCropUri(asset.uri);
  }

  const cropper = (
    <PhotoCropper
      uri={cropUri}
      onCancel={() => setCropUri(null)}
      onDone={(media) => {
        setCropUri(null);
        onPicked(media);
      }}
    />
  );

  return {
    pickFromLibrary: () => launch('library'),
    takePhoto: () => launch('photo'),
    recordVideo: () => launch('video'),
    /** True while a picked video is being prepared. */
    processing,
    cropper,
  };
}
