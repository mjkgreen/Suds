import * as VideoThumbnails from 'expo-video-thumbnails';

export interface VideoPoster {
  uri: string;
  /** Display size of the video (rotation already applied). */
  width: number;
  height: number;
}

/** Grabs an early frame of a local video to use as its poster image. */
export async function createVideoPoster(videoUri: string): Promise<VideoPoster> {
  const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(videoUri, {
    time: 100,
    quality: 0.8,
  });
  return { uri, width, height };
}
