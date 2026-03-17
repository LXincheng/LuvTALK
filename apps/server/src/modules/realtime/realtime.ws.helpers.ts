import { REALTIME_DEFAULT_TURN_DETECTION } from "./realtime.constants";
import {
  REALTIME_SERVER_ERROR_CODES,
  RealtimeServerErrorCode,
} from "./realtime-error.types";

export const buildSessionUpdate = (params: {
  instructions: string;
  voice: string;
  turnDetection: typeof REALTIME_DEFAULT_TURN_DETECTION;
  transcribeModel?: string;
}) => {
  const realtimeTranscribeModel = params.transcribeModel
    ?.toLowerCase()
    .includes("whisper")
    ? params.transcribeModel
    : "whisper-1";
  return {
    type: "session.update",
    session: {
      instructions: params.instructions,
      voice: params.voice,
      turn_detection: {
        ...params.turnDetection,
        create_response: true,
        interrupt_response: true,
      },
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: realtimeTranscribeModel,
      },
      modalities: ["audio", "text"],
    },
  };
};

export const mapCloseCodeToErrorCode = (
  code: number,
): { code: RealtimeServerErrorCode; message: string; retriable: boolean } => {
  if (code === 1008) {
    return {
      code: REALTIME_SERVER_ERROR_CODES.PERMISSION_DENIED,
      message: "Permission denied",
      retriable: false,
    };
  }
  if (code === 1013) {
    return {
      code: REALTIME_SERVER_ERROR_CODES.RATE_LIMITED,
      message: "Rate limited",
      retriable: true,
    };
  }
  return {
    code: REALTIME_SERVER_ERROR_CODES.UPSTREAM_ERROR,
    message: "Realtime upstream closed",
    retriable: true,
  };
};

export const resolveSafeCloseCode = (code: number): number => {
  // 1006 is reserved and cannot be sent in close frames.
  if (code === 1006) {
    return 1011;
  }
  return code;
};
