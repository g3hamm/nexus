import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { DataPacket_Kind, TrackSource } from "@livekit/protocol";
import type {
  AccessGrant,
  CreateRoomInput,
  IssueTokenInput,
  RealtimeEvent,
  RealtimeTransport,
  RoomHandle,
  RoomId,
} from "@nexus/core";
import { NexusError, asRoomId } from "@nexus/core";

export interface LiveKitConfig {
  /** wss:// URL of the LiveKit deployment. */
  readonly url: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  /** Host for the server-side management API. Derived from `url` if omitted. */
  readonly host?: string;
}

/**
 * LiveKit-backed realtime transport.
 *
 * Text messages travel over LiveKit's data channel today. The room, the
 * participants, the identities, and the permission model are all already what
 * a voice or video call needs — turning one on is `capabilitiesFor("video")`
 * granting `canPublish` and a client that renders tracks. No new service, no
 * second matching path, no migration.
 */
export class LiveKitTransport implements RealtimeTransport {
  readonly name = "livekit";
  readonly #config: LiveKitConfig;
  readonly #rooms: RoomServiceClient;

  constructor(config: LiveKitConfig) {
    if (!config.url || !config.apiKey || !config.apiSecret) {
      throw new NexusError(
        "provider_unavailable",
        "LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are all required",
      );
    }
    this.#config = config;
    // The management API speaks https where the client speaks wss.
    const host = config.host ?? config.url.replace(/^wss?:\/\//, "https://");
    this.#rooms = new RoomServiceClient(host, config.apiKey, config.apiSecret);
  }

  async createRoom(input: CreateRoomInput): Promise<RoomHandle> {
    const roomId = asRoomId(`nexus-${input.conversationId}`);
    try {
      await this.#rooms.createRoom({
        name: roomId,
        // Hold the room open while a seeker waits for a volunteer.
        emptyTimeout: input.emptyTimeoutSeconds ?? 15 * 60,
        // A conversation is two people. Refusing a third at the transport
        // layer means a leaked token cannot be used to listen in.
        maxParticipants: 2,
      });
    } catch (error) {
      throw new NexusError(
        "provider_unavailable",
        "Could not create the realtime room",
        { roomId },
        { cause: error },
      );
    }
    return {
      roomId,
      conversationId: input.conversationId,
      createdAt: new Date(),
    };
  }

  async issueAccessToken(input: IssueTokenInput): Promise<AccessGrant> {
    const token = new AccessToken(this.#config.apiKey, this.#config.apiSecret, {
      identity: input.participantId,
      name: input.displayName,
      ttl: input.ttlSeconds,
    });

    const canPublishMedia =
      input.capabilities.canPublishAudio || input.capabilities.canPublishVideo;

    // Only the sources this modality actually needs. A text conversation's
    // token cannot publish camera or microphone even if the client asks.
    const sources: TrackSource[] = [];
    if (input.capabilities.canPublishAudio) sources.push(TrackSource.MICROPHONE);
    if (input.capabilities.canPublishVideo) sources.push(TrackSource.CAMERA);

    token.addGrant({
      room: input.roomId,
      roomJoin: true,
      canSubscribe: input.capabilities.canSubscribe,
      canPublish: canPublishMedia,
      canPublishData: input.capabilities.canPublishData,
      ...(sources.length > 0 ? { canPublishSources: sources } : {}),
      // Participants must not be able to rewrite their own identity metadata.
      canUpdateOwnMetadata: false,
    });

    return {
      token: await token.toJwt(),
      url: this.#config.url,
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    };
  }

  async publishEvent(roomId: RoomId, event: RealtimeEvent): Promise<void> {
    const payload = new TextEncoder().encode(JSON.stringify(event));
    try {
      await this.#rooms.sendData(roomId, payload, DataPacket_Kind.RELIABLE, {
        topic: "nexus",
      });
    } catch (error) {
      // A dropped notification is recoverable — the client refetches from the
      // database on reconnect — so this must not fail the request that sent it.
      throw new NexusError(
        "provider_unavailable",
        "Could not publish the realtime event",
        { roomId, eventType: event.type },
        { cause: error },
      );
    }
  }

  async closeRoom(roomId: RoomId): Promise<void> {
    try {
      await this.#rooms.deleteRoom(roomId);
    } catch {
      // Already gone is the desired end state, so treat it as success.
    }
  }
}
