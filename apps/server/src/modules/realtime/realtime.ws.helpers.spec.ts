import { REALTIME_DEFAULT_TURN_DETECTION } from "./realtime.constants";
import { REALTIME_SERVER_ERROR_CODES } from "./realtime-error.types";
import {
  buildSessionUpdate,
  mapCloseCodeToErrorCode,
  resolveSafeCloseCode,
} from "./realtime.ws.helpers";

describe("realtime.ws.helpers", () => {
  describe("buildSessionUpdate", () => {
    it("uses the official Qwen server_vad mode", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Serena",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect(payload.session.turn_detection).toEqual({
        type: "server_vad",
        threshold: 0.5,
        silence_duration_ms: 900,
      });
    });

    it("keeps VAD response creation on the provider default path", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Serena",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect("create_response" in payload.session.turn_detection).toBe(false);
      expect("interrupt_response" in payload.session.turn_detection).toBe(false);
    });

    it("enables official realtime input audio transcription on the main session", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Jennifer",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect(payload.session.input_audio_transcription).toEqual({
        model: "qwen3-asr-flash-realtime",
      });
    });
  });

  describe("mapCloseCodeToErrorCode", () => {
    it("maps 1008 to permission denied", () => {
      const mapped = mapCloseCodeToErrorCode(1008);
      expect(mapped.code).toBe(REALTIME_SERVER_ERROR_CODES.PERMISSION_DENIED);
      expect(mapped.retriable).toBe(false);
    });

    it("maps 1013 to rate limited", () => {
      const mapped = mapCloseCodeToErrorCode(1013);
      expect(mapped.code).toBe(REALTIME_SERVER_ERROR_CODES.RATE_LIMITED);
      expect(mapped.retriable).toBe(true);
    });

    it("maps unknown code to upstream error", () => {
      const mapped = mapCloseCodeToErrorCode(1011);
      expect(mapped.code).toBe(REALTIME_SERVER_ERROR_CODES.UPSTREAM_ERROR);
      expect(mapped.retriable).toBe(true);
    });
  });

  describe("resolveSafeCloseCode", () => {
    it("maps reserved close code 1006 to 1011", () => {
      expect(resolveSafeCloseCode(1006)).toBe(1011);
    });

    it("keeps valid close code unchanged", () => {
      expect(resolveSafeCloseCode(1000)).toBe(1000);
    });
  });
});
