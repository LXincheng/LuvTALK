import { REALTIME_DEFAULT_TURN_DETECTION } from "./realtime.constants";
import { REALTIME_SERVER_ERROR_CODES } from "./realtime-error.types";
import {
  buildSessionUpdate,
  mapCloseCodeToErrorCode,
  resolveSafeCloseCode,
} from "./realtime.ws.helpers";

describe("realtime.ws.helpers", () => {
  describe("buildSessionUpdate", () => {
    it("enables create_response by default", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Serena",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect(payload.session.turn_detection.create_response).toBe(true);
    });

    it("enables interrupt_response by default", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Serena",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect(payload.session.turn_detection.interrupt_response).toBe(true);
    });

    it("uses the provided realtime transcribe model without forcing whisper fallback", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Jennifer",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
        transcribeModel: "qwen3-asr-flash-realtime",
      });
      expect(payload.session.input_audio_transcription?.model).toBe(
        "qwen3-asr-flash-realtime",
      );
    });

    it("omits input_audio_transcription when no model is configured", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Jennifer",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect(payload.session.input_audio_transcription).toBeUndefined();
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
