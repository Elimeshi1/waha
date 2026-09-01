/**
 * [WAHA] How much to compress a video when converting it for WhatsApp.
 *
 * Smaller files download faster on the recipient's phone, at the cost of some
 * visual quality. ORIGINAL keeps the historical behaviour - re-encode to a
 * WhatsApp compatible mp4 without touching resolution or bitrate.
 */
export enum VideoQuality {
  ORIGINAL = 'original',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface IMediaConverter {
  voice(content: Buffer): Promise<Buffer>;
  // [WAHA] quality added, see VideoQuality above
  video(content: Buffer, quality: VideoQuality): Promise<Buffer>;
}
