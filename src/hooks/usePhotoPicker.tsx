import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { PhotoCropper } from '@/components/media/PhotoCropper';
import { LocalMedia } from '@/lib/media';

/**
 * Picks a photo from the camera or library and sends it through the cropper.
 * Render `cropper` somewhere in the screen; `onPicked` fires with the cropped
 * photo once the user taps Done.
 */
export function usePhotoPicker(onPicked: (media: LocalMedia) => void) {
  const [cropUri, setCropUri] = useState<string | null>(null);

  async function pickPhoto(useCamera: boolean) {
    // No native editing — the native iOS editor only crops square, so all
    // cropping happens in our own cropper.
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    };
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) {
      setCropUri(result.assets[0].uri);
    }
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

  return { pickPhoto, cropper };
}
