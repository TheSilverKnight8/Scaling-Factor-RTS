// Lets Node run the app's TypeScript files directly (with --experimental-strip-types):
// the app imports files without the ".ts" ending, as Vite allows, so this adds it.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, context);
  }
  return next(specifier, context);
}
