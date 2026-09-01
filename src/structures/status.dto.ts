import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ConvertApiProperty } from '@waha/structures/properties.dto';
import { BooleanString } from '@waha/nestjs/validation/BooleanString';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import {
  BinaryFile,
  RemoteFile,
  VideoBinaryFile,
  VideoRemoteFile,
  VoiceBinaryFile,
  VoiceRemoteFile,
} from './files.dto';

export const BROADCAST_ID = 'status@broadcast';

const ContactsProperty = ApiProperty({
  description: 'Contact list to send the status to.',
  example: null,
  required: false,
});

export class StatusRequest {
  @ApiProperty({
    description: 'Pre-generated status message id',
    example: 'BBBBBBBBBBBBBBBBB',
    default: null,
    required: false,
  })
  id?: string;

  @ContactsProperty
  contacts?: string[];
}

export class TextStatus extends StatusRequest {
  text: string = 'Have a look! https://github.com/';
  backgroundColor: string = '#38b42f';
  font: number = 0;

  linkPreview?: boolean = true;
  linkPreviewHighQuality?: boolean = false;
}

@ApiExtraModels(RemoteFile, BinaryFile)
export class ImageStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(RemoteFile) },
      { $ref: getSchemaPath(BinaryFile) },
    ],
  })
  file: RemoteFile | BinaryFile;

  caption?: string;
}

@ApiExtraModels(VoiceRemoteFile, VoiceBinaryFile)
export class VoiceStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VoiceRemoteFile) },
      { $ref: getSchemaPath(VoiceBinaryFile) },
    ],
  })
  file: VoiceRemoteFile | VoiceBinaryFile;

  backgroundColor: string = '#38b42f';

  @ConvertApiProperty()
  convert: boolean;
}

@ApiExtraModels(VideoRemoteFile, VideoBinaryFile)
export class VideoStatus extends StatusRequest {
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VideoRemoteFile) },
      { $ref: getSchemaPath(VideoBinaryFile) },
    ],
  })
  file: VideoRemoteFile | VideoBinaryFile;

  caption?: string;

  @ConvertApiProperty()
  convert: boolean;
}

export class DeleteStatusRequest extends StatusRequest {
  @ApiProperty({
    description: 'Status message id to delete',
    example: 'AAAAAAAAAAAAAAAAA',
  })
  id: string;

  @ContactsProperty
  contacts?: string[];
}

export class StatusAckSummary {
  @ApiProperty({
    description: 'Status message id',
    example: '3EB0C767D097E9ECFE8B',
  })
  messageId: string;

  @ApiProperty({
    description:
      'Number of unique participants that received the status (ack >= DEVICE)',
    example: 0,
  })
  received: number;

  @ApiProperty({
    description:
      'Number of unique participants that viewed the status (ack >= READ)',
    example: 0,
  })
  read: number;

  @ApiProperty({
    description:
      'Participants (usually @lid) that received the status. Viewers are a subset of these. ' +
      'Only present when `participants=true`.',
    type: [String],
    required: false,
    example: [],
  })
  receivedParticipants?: string[];

  @ApiProperty({
    description:
      'Participants (usually @lid) that viewed the status. ' +
      'Only present when `participants=true`.',
    type: [String],
    required: false,
    example: [],
  })
  readParticipants?: string[];
}

export class GetStatusAckQuery {
  @ApiProperty({
    required: false,
    example: false,
    description:
      'Include the participant lists (receivedParticipants/readParticipants). ' +
      'By default only the counts are returned.',
  })
  @Transform(BooleanString)
  @IsBoolean()
  @IsOptional()
  participants: boolean = false;
}
