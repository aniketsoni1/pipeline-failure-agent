// Bundles the CLI into a single self-contained CommonJS file with a shebang, so
// the published package runs on plain Node with no tsx and no @pfa/* workspace
// resolution. `@pfa/<pkg>` is resolved to packages/<pkg>/src the same way the
// VS Code extension bundle does.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

const pfaAlias = {
  name: 'pfa-alias',
  setup(b) {
    b.onResolve({ filter: /^@pfa\// }, (args) => ({
      path: resolve(root, 'packages', args.path.replace('@pfa/', ''), 'src/index.ts'),
    }));
  },
};

await build({
  entryPoints: [resolve(root, 'apps/cli/src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: resolve(root, 'dist/cli/index.cjs'),
  banner: { js: '#!/usr/bin/env node' },
  // Optional cloud SDK is resolved lazily at runtime; never bundle it.
  external: ['@aws-sdk/client-secrets-manager'],
  plugins: [pfaAlias],
  logLevel: 'info',
});

console.log('Built dist/cli/index.cjs');
