/**
 * Copies the bundled scripture into dist alongside the compiled JavaScript.
 *
 * `tsc` does not emit assets, and the provider loads `./data/web.json`
 * relative to itself, so without this the build succeeds and every lookup
 * fails at runtime — which is the worst shape a failure can have.
 */
import { cpSync } from "node:fs";

cpSync(
  new URL("../src/data", import.meta.url),
  new URL("../dist/data", import.meta.url),
  {
    recursive: true,
  },
);
