import type { VideoPoster } from './videoPoster';

export type { VideoPoster };

/** Web version: draws an early frame of the video to a canvas. */
export function createVideoPoster(videoUri: string): Promise<VideoPoster> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUri;

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Could not read video frame.'));
          resolve({ uri: URL.createObjectURL(blob), width: video.videoWidth, height: video.videoHeight });
        },
        'image/jpeg',
        0.8,
      );
    };
    video.onerror = () => reject(new Error('Could not load video.'));
  });
}
