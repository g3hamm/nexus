/**
 * @nexus/crypto — envelope encryption for conversation content.
 *
 * Repositories call `ConversationCrypto`; nothing else in Nexus should.
 * See docs/adr/0003-application-layer-encryption.md for what this does and
 * does not protect against.
 */
export { ALGORITHM } from "./aes.js";
export { EnvelopeCrypto } from "./envelope.js";
export { LocalKeyManagement } from "./local-kms.js";
export { AwsKmsKeyManagement } from "./aws-kms.js";
export { DataKeyCache } from "./key-cache.js";
export {
  createKeyManagement,
  createConversationCrypto,
  type CryptoConfig,
} from "./factory.js";
