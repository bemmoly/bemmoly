// TypeScript 7 (the native compiler) runs `tsc` and has no JavaScript API yet.
// typescript-eslint needs that API, so its packages get TypeScript 6 through
// the TypeScript team's side-by-side package instead of the workspace's 7.
const TYPESCRIPT_6 = 'npm:@typescript/typescript6@6.0.2';
const NEEDS_TS_API = /^(@typescript-eslint\/|typescript-eslint$|ts-api-utils$)/;

function readPackage(pkg) {
  if (NEEDS_TS_API.test(pkg.name) && pkg.peerDependencies && pkg.peerDependencies.typescript) {
    delete pkg.peerDependencies.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: TYPESCRIPT_6 };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
