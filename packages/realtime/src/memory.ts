import type {
  AccessGrant,
  CreateRoomInput,
  IssueTokenInput,
  RealtimeEvent,
  RealtimeTransport,
  RoomHandle,
  RoomId,
} from "@nexus/core";
import { asRoomId } from "@nexus/core";

/**
 * An in-process transport for tests and for `NEXUS_REALTIME_PROVIDER=memory`.
 *
 * Lets the whole conversation flow be exercised without LiveKit credentials,
 * which keeps the test suite fast and lets a new contributor run the app on
 * day one. It has no cross-process delivery, so it is useless in production
 * and the factory will not hand it back there.
 */
export class InMemoryTransport implements RealtimeTransport {
  readonly name = "memory";
  readonly published: { roomId: RoomId; event: RealtimeEvent }[] = [];
  readonly #rooms = new Set<string>();
  readonly #listeners = new Map<string, ((event: RealtimeEvent) => void)[]>();

  async createRoom(input: CreateRoomInput): Promise<RoomHandle> {
    const roomId = asRoomId(`nexus-${input.conversationId}`);
    this.#rooms.add(roomId);
    return { roomId, conversationId: input.conversationId, createdAt: new Date() };
  }

  async issueAccessToken(input: IssueTokenInput): Promise<AccessGrant> {
    return {
      // Not a real credential — encodes the grant so tests can assert on it.
      token: Buffer.from(
        JSON.stringify({
          room: input.roomId,
          identity: input.participantId,
          role: input.role,
          capabilities: input.capabilities,
        }),
      ).toString("base64"),
      url: "memory://nexus",
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
    };
  }

  async publishEvent(roomId: RoomId, event: RealtimeEvent): Promise<void> {
    this.published.push({ roomId, event });
    for (const listener of this.#listeners.get(roomId) ?? []) listener(event);
  }

  async closeRoom(roomId: RoomId): Promise<void> {
    this.#rooms.delete(roomId);
    this.#listeners.delete(roomId);
  }

  /** Test helper: observe events published to a room. */
  subscribe(roomId: RoomId, listener: (event: RealtimeEvent) => void): () => void {
    const list = this.#listeners.get(roomId) ?? [];
    list.push(listener);
    this.#listeners.set(roomId, list);
    return () => {
      const current = this.#listeners.get(roomId) ?? [];
      this.#listeners.set(
        roomId,
        current.filter((l) => l !== listener),
      );
    };
  }

  reset(): void {
    this.published.length = 0;
    this.#rooms.clear();
    this.#listeners.clear();
  }
}
