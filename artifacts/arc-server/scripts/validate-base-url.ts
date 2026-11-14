#!/usr/bin/env npx tsx
import { mainCli } from "../src/lib/validationBaseUrl.js";

const code = await mainCli(process.argv.slice(2));
process.exit(code);
