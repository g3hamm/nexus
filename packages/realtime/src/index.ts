/**
 * @nexus/realtime — the realtime transport.
 *
 * See docs/adr/0002-livekit-for-realtime.md for why this is LiveKit and not
 * Vercel's own WebSocket support, and for how voice and video arrive later
 * without touching anything above this package.
 */
export { LiveKitTransport, type LiveKitConfig } from "./livekit.js";
export { InMemoryTransport } from "./memory.js";
export { createRealtimeTransport, type RealtimeConfig } from "./factory.js";
