import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  it("treats connection pool timeout as a connection error", () => {
    const service = new PrismaService();

    expect(
      service.isConnectionError({
        code: "P2024",
        message: "Timed out fetching a new connection from the connection pool.",
      }),
    ).toBe(true);
  });
});
