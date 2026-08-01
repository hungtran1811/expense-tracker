import { rmSync } from "node:fs";
import { join } from "node:path";

/** Binary download packs must not ship inside Capacitor native assets. */
const target = join(process.cwd(), "dist", "downloads");
rmSync(target, { recursive: true, force: true });
console.log("Removed dist/downloads before native sync");
