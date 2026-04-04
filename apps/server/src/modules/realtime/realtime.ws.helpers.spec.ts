import { REALTIME_DEFAULT_TURN_DETECTION } from "./realtime.constants";
import { REALTIME_SERVER_ERROR_CODES } from "./realtime-error.types";
import {
  buildSessionUpdate,
  mapCloseCodeToErrorCode,
  resolveSafeCloseCode,
} from "./realtime.ws.helpers";

describe("realtime.ws.helpers", () => {
  describe("buildSessionUpdate", () => {
    it("enables create_response in server_vad mode", () => {
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

    it("omits input_audio_transcription to stay on the realtime main path", () => {
      const payload = buildSessionUpdate({
        instructions: "test",
        voice: "Jennifer",
        turnDetection: REALTIME_DEFAULT_TURN_DETECTION,
      });
      expect("input_audio_transcription" in payload.session).toBe(false);
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
