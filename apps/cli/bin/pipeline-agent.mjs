#!/usr/bin/env node
/**
 * Dev entrypoint: runs the TypeScript CLI directly via the tsx ESM loader using
 * tsx's public programmatic API. For distribution, `npm run build:cli` bundles
 * this to plain JS (see docs) and this loader is no longer needed.
 */
import { register } from 'tsx/esm/api';

register();
await import(new URL('../src/index.ts', import.meta.url).href);
