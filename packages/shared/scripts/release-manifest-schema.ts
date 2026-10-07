/**
 * Writes deploy/release-manifest.schema.json from releaseManifestSchema. The release
 * workflow validates every manifest against that file; a core test keeps the two equal.
 *
 *   pnpm --filter @bemmoly/shared schema:release
 */
import { writeFileSync } from 'node:fs';
import { releaseManifestJsonSchema } from '../src/schemas/system/release-manifest.ts';

const target = new URL('../../../deploy/release-manifest.schema.json', import.meta.url);
const document = {
  $id: 'https://get.bemmoly.dev/releases/release-manifest.schema.json',
  title: 'Bemmoly release manifest',
  description:
    'One release, written by tools/release and published as release-manifest.json on the GitHub release, signed keyless with a detached release-manifest.json.sigstore.json bundle. Generated from releaseManifestSchema in packages/shared.',
  ...releaseManifestJsonSchema(),
};
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
