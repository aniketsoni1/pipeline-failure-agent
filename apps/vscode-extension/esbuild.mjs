import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const watch = process.argv.includes('--watch');

/** Resolve "@pfa/<pkg>" -> "<root>/packages/<pkg>/src" so the extension bundles
 *  the same shared core the CLI uses (single source of truth). */
const pfaAlias = {
  name: 'pfa-alias',
  setup(b) {
    b.onResolve({ filter: /^@pfa\// }, (args) => {
      const pkg = args.path.replace('@pfa/', '');
      return { path: resolve(root, 'packages', pkg, 'src/index.ts') };
    });
  },
};

const options = {
  entryPoints: [resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/extension.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: true,
  plugins: [pfaAlias],
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
