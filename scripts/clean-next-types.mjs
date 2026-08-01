import { rmSync } from "node:fs";

rmSync(".next/types", { recursive: true, force: true });
