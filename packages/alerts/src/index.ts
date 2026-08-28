/**
 * @nexus/alerts — reaching a human operator outside the app.
 *
 * Separate from moderation on purpose. Moderation decides *what* is
 * happening and writes it down durably; this is only the doorbell.
 */
export { ConsoleAlertChannel, WebhookAlertChannel, PAYLOAD_FOR_TESTS } from "./webhook.js";
export { createAlertChannel, type AlertChannelOptions } from "./factory.js";
