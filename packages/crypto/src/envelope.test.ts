import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { asConversationId, isNexusError, type EncryptionContext } from "@nexus/core";
import { EnvelopeCrypto } from "./envelope.js";
import { LocalKeyManagement } from "./local-kms.js";
import { DataKeyCache } from "./key-cache.js";
import { createKeyManagement } from "./factory.js";

const CONVERSATION_A = asConversationId("conv-aaaa");
const CONVERSATION_B = asConversationId("conv-bbbb");

function subject() {
  const kms = new LocalKeyManagement(randomBytes(32));
  return { kms, crypto: new EnvelopeCrypto(kms) };
}

const ctx = (id = CONVERSATION_A): EncryptionContext => ({
  conversationId: id,
  purpose: "message",
});

describe("EnvelopeCrypto", () => {
  it("round-trips text", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("Peace be with you", key, ctx());

    expect(sealed.ciphertext).not.toContain("Peace");
    await expect(crypto.decrypt(sealed, key, ctx())).resolves.toBe("Peace be with you");
  });

  it("round-trips non-Latin scripts and emoji intact", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const samples = [
      "السلام عليكم",
      "上帝就是爱",
      "Благодать вам",
      "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
      "🕊️ shalom",
    ];
    for (const sample of samples) {
      const sealed = await crypto.encrypt(sample, key, ctx());
      await expect(crypto.decrypt(sealed, key, ctx())).resolves.toBe(sample);
    }
  });

  it("uses a fresh IV for every encryption", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const a = await crypto.encrypt("same text", key, ctx());
    const b = await crypto.encrypt("same text", key, ctx());

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("refuses to decrypt under a different conversation", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("private", key, ctx(CONVERSATION_A));

    // A row lifted from conversation A into conversation B must not open.
    await expect(crypto.decrypt(sealed, key, ctx(CONVERSATION_B))).rejects.toThrow(
      /does not match/,
    );
  });

  it("refuses to decrypt under a different purpose", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("private", key, {
      conversationId: CONVERSATION_A,
      purpose: "message",
    });

    await expect(
      crypto.decrypt(sealed, key, {
        conversationId: CONVERSATION_A,
        purpose: "flag_evidence",
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("detects tampered ciphertext", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("original text", key, ctx());

    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
    const tampered = { ...sealed, ciphertext: bytes.toString("base64") };

    await expect(crypto.decrypt(tampered, key, ctx())).rejects.toThrow();
  });

  it("detects a tampered authentication tag", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("original text", key, ctx());

    const tag = Buffer.from(sealed.authTag, "base64");
    tag[0] = (tag[0]! ^ 0xff) & 0xff;

    await expect(
      crypto.decrypt({ ...sealed, authTag: tag.toString("base64") }, key, ctx()),
    ).rejects.toThrow();
  });

  it("cannot open one conversation's data with another's key", async () => {
    const { crypto } = subject();
    const keyA = await crypto.createDataKey(CONVERSATION_A);
    const keyB = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("for A only", keyA, ctx());

    await expect(crypto.decrypt(sealed, keyB, ctx())).rejects.toThrow();
  });

  it("rejects an unknown ciphertext version rather than guessing", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    const sealed = await crypto.encrypt("text", key, ctx());

    await expect(crypto.decrypt({ ...sealed, version: 99 }, key, ctx())).rejects.toThrow(
      /Unsupported ciphertext version/,
    );
  });

  it("never stores the data key in the clear", async () => {
    const { crypto } = subject();
    const key = await crypto.createDataKey(CONVERSATION_A);
    // The wrapped blob is iv.tag.ciphertext — three base64 segments, no raw key.
    expect(key.wrapped.split(".")).toHaveLength(3);
    expect(key.keyId).toBe("local-dev");
  });
});

describe("DataKeyCache", () => {
  it("returns a cached key and evicts past the size bound", () => {
    const cache = new DataKeyCache({ maxEntries: 2, ttlMs: 60_000 });
    const k1 = randomBytes(32);
    cache.set("a", k1);
    cache.set("b", randomBytes(32));

    expect(cache.get("a")).toBe(k1);

    cache.set("c", randomBytes(32)); // evicts the least recently used, "b"
    expect(cache.size).toBe(2);
    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")).toBe(k1);
  });

  it("expires entries after the TTL", () => {
    const cache = new DataKeyCache({ maxEntries: 4, ttlMs: -1 });
    cache.set("a", randomBytes(32));
    expect(cache.get("a")).toBeNull();
  });
});

describe("createKeyManagement", () => {
  it("refuses local key management in production", () => {
    expect(() =>
      createKeyManagement({
        provider: "local",
        masterKeyBase64: randomBytes(32).toString("base64"),
        isProduction: true,
      }),
    ).toThrow(/Refusing to start/);
  });

  it("allows local key management outside production", () => {
    const kms = createKeyManagement({
      provider: "local",
      masterKeyBase64: randomBytes(32).toString("base64"),
      isProduction: false,
    });
    expect(kms.name).toBe("local");
  });

  it("rejects a master key that is not 32 bytes", () => {
    try {
      createKeyManagement({
        provider: "local",
        masterKeyBase64: Buffer.from("too short").toString("base64"),
        isProduction: false,
      });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(isNexusError(e)).toBe(true);
      expect((e as Error).message).toMatch(/32 bytes/);
    }
  });

  it("requires a key id when using AWS KMS", () => {
    expect(() => createKeyManagement({ provider: "aws", isProduction: true })).toThrow(
      /AWS_KMS_KEY_ID is required/,
    );
  });
});
