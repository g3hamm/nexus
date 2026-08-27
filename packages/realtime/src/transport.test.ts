import { describe, expect, it } from "vitest";
import { asConversationId, capabilitiesFor } from "@nexus/core";
import { InMemoryTransport } from "./memory.js";
import { createRealtimeTransport } from "./factory.js";

describe("capability grants by modality", () => {
  it("gives a text conversation data only — no camera, no microphone", () => {
    const caps = capabilitiesFor("text");
    expect(caps.canPublishData).toBe(true);
    expect(caps.canPublishAudio).toBe(false);
    expect(caps.canPublishVideo).toBe(false);
    expect(caps.canSubscribe).toBe(true);
  });

  it("adds the microphone for audio, and the camera only for video", () => {
    const audio = capabilitiesFor("audio");
    expect(audio.canPublishAudio).toBe(true);
    expect(audio.canPublishVideo).toBe(false);

    const video = capabilitiesFor("video");
    expect(video.canPublishAudio).toBe(true);
    expect(video.canPublishVideo).toBe(true);
    // Text still works in a video call.
    expect(video.canPublishData).toBe(true);
  });
});

describe("InMemoryTransport", () => {
  it("names the room after the conversation", async () => {
    const transport = new InMemoryTransport();
    const conversationId = asConversationId("abc-123");
    const room = await transport.createRoom({ conversationId, modality: "text" });

    expect(room.roomId).toBe("nexus-abc-123");
    expect(room.conversationId).toBe(conversationId);
  });

  it("delivers published events to subscribers", async () => {
    const transport = new InMemoryTransport();
    const room = await transport.createRoom({
      conversationId: asConversationId("abc-123"),
      modality: "text",
    });

    const seen: string[] = [];
    transport.subscribe(room.roomId, (event) => seen.push(event.type));

    await transport.publishEvent(room.roomId, {
      type: "message",
      messageId: "m1",
      sentAt: new Date().toISOString(),
    });
    await transport.publishEvent(room.roomId, {
      type: "presence",
      role: "volunteer",
      joined: true,
    });

    expect(seen).toEqual(["message", "presence"]);
    expect(transport.published).toHaveLength(2);
  });

  it("carries the granted capabilities in the token", async () => {
    const transport = new InMemoryTransport();
    const room = await transport.createRoom({
      conversationId: asConversationId("abc-123"),
      modality: "text",
    });

    const grant = await transport.issueAccessToken({
      roomId: room.roomId,
      participantId: "seeker-1",
      role: "seeker",
      displayName: "Guest",
      capabilities: capabilitiesFor("text"),
      ttlSeconds: 3600,
    });

    const decoded = JSON.parse(Buffer.from(grant.token, "base64").toString());
    expect(decoded.capabilities.canPublishVideo).toBe(false);
    expect(decoded.role).toBe("seeker");
    expect(grant.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("createRealtimeTransport", () => {
  it("refuses the in-memory transport in production", () => {
    expect(() =>
      createRealtimeTransport({ provider: "memory", isProduction: true }),
    ).toThrow(/must not be used in production/);
  });

  it("allows the in-memory transport in development", () => {
    const transport = createRealtimeTransport({
      provider: "memory",
      isProduction: false,
    });
    expect(transport.name).toBe("memory");
  });

  it("requires LiveKit credentials when LiveKit is selected", () => {
    expect(() =>
      createRealtimeTransport({ provider: "livekit", isProduction: true }),
    ).toThrow(/LIVEKIT_URL/);
  });

  it("rejects an unknown provider by name", () => {
    expect(() =>
      createRealtimeTransport({ provider: "carrier-pigeon", isProduction: false }),
    ).toThrow(/Unknown realtime provider/);
  });
});
