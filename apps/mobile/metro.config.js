/**
 * Purpose: Metro config — pnpm monorepo + sibling nself-org/packages support.
 * Inputs: expo/metro-config defaults.
 * Outputs: watchFolders spanning the workspace + sibling packages; a resolver
 *          that maps ESM-style `./x.js` imports in @nself TS sources to their
 *          .ts files (Metro bundles TS sources directly, not compiled output).
 * Constraints: keep resolveRequest fallback-safe — only rewrites relative .js
 *   specifiers originating from TS packages; everything else uses default resolution.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const siblingPackages = path.resolve(projectRoot, '../../../packages');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot, siblingPackages];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(repoRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // TS packages in this workspace use explicit .js extensions per ESM convention;
  // Metro bundles their .ts sources, so retry without the extension.
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const origin = context.originModulePath ?? '';
    if (origin.includes(`${path.sep}@nself${path.sep}`) || origin.includes(`${path.sep}packages${path.sep}client${path.sep}`)) {
      try {
        return context.resolveRequest(context, moduleName.replace(/\.js$/, ''), platform);
      } catch {
        // fall through to default resolution
      }
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
