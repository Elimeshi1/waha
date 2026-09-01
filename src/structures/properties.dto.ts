import { ApiProperty, ApiPropertyOptions } from '@nestjs/swagger';
import { VideoQuality } from '@waha/core/media/IMediaConverter';

function ChatIdProperty(options: ApiPropertyOptions | null = null) {
  options = options || {};
  if (!options.example) {
    options.example = '11111111111@c.us';
  }
  return ApiProperty(options);
}

function MessageIdProperty() {
  return ApiProperty({
    description: 'Message ID',
    example: 'false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
  });
}

function MessageIdOnlyProperty() {
  return ApiProperty({
    description: 'Message ID',
    example: 'AAAAAAAAAAAAAAAAAAAA',
  });
}

function ReplyToProperty() {
  return ApiProperty({
    description:
      'The ID of the message to reply to - false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA',
    example: null,
  });
}

function GeneratedMessageIdProperty() {
  return ApiProperty({
    description: 'Pre-generated message id',
    example: 'BBBBBBBBBBBBBBBBB',
    default: null,
    required: false,
  });
}

export function ConvertApiProperty() {
  return ApiProperty({
    description:
      'Convert the input file to the required format using ffmpeg before sending',
    example: true,
  });
}

export function VideoQualityApiProperty() {
  return ApiProperty({
    description:
      'How much to compress the video when "convert" is enabled. ' +
      'Lower quality means a smaller file that downloads faster for the ' +
      'recipient. "original" keeps the resolution and bitrate untouched. ' +
      'Roughly, compared to "original": high ~55% smaller, ' +
      'medium ~78% smaller, low ~93% smaller.',
    enum: VideoQuality,
    required: false,
    default: VideoQuality.ORIGINAL,
    example: VideoQuality.MEDIUM,
  });
}

export {
  ChatIdProperty,
  GeneratedMessageIdProperty,
  MessageIdOnlyProperty,
  MessageIdProperty,
  ReplyToProperty,
};
