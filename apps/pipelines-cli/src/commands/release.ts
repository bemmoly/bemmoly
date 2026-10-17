import { connect, parse, SERVER_FLAGS, type Context } from '../cli/context.ts';
import { usageError } from '../cli/errors.ts';
import { githubOidcToken } from '../services/oidc.ts';
import { buildReleaseBody, platformDigests } from '../services/release.ts';

/*
 * bp release create: register a release built by another CI system (Bring your CI). The
 * token is --token, BEMMOLY_PIPELINES_TOKEN (a scoped CI token), the stored sign-in, or,
 * inside GitHub Actions with id-token: write, the workflow's own OIDC token.
 */

const OPTIONS = {
  ...SERVER_FLAGS,
  application: { type: 'string' },
  version: { type: 'string' },
  commit: { type: 'string' },
  ref: { type: 'string' },
  'image-repository': { type: 'string' },
  image: { type: 'string' },
  images: { type: 'string', multiple: true },
  junit: { type: 'string', multiple: true },
  attestation: { type: 'string' },
  url: { type: 'string' },
  notes: { type: 'string' },
} as const;

export async function releaseCommand(ctx: Context, argv: readonly string[]): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub !== 'create')
    throw usageError('Use "bp release create --application <key> --commit <sha> --image sha256:…"');
  const { values, positionals } = parse(rest, OPTIONS);
  const application = values.application ?? positionals[0];
  if (!application) throw usageError('Name the application: --application checkout-api');
  if (!values.commit) throw usageError('Name the commit the image was built from: --commit <sha>');
  const body = buildReleaseBody({
    application,
    commitSha: values.commit,
    version: values.version,
    ref: values.ref,
    imageRepository: values['image-repository'],
    image: values.image,
    images: values.images ? platformDigests(values.images) : undefined,
    junit: await Promise.all((values.junit ?? []).map((path) => ctx.readFile(path))),
    attestation: values.attestation ? await ctx.readFile(values.attestation) : undefined,
    externalUrl: values.url,
    notes: values.notes,
  });
  const token = values.token ?? (await workflowToken(ctx, values.server));
  const { client, server } = await connect(ctx, { server: values.server, token });
  const release = await client.registerRelease(body);
  ctx.output.out(`Registered ${release.application.key} ${release.version} on ${server}.`);
  if (release.testSummary) {
    const { total, passed, failed, skipped } = release.testSummary;
    ctx.output.out(`Tests: ${passed} passed, ${failed} failed, ${skipped} skipped of ${total}.`);
  }
  ctx.output.out(`Release id: ${release.id}`);
  return 0;
}

/** The workflow's OIDC token, when bp runs in GitHub Actions and has no other token. */
async function workflowToken(ctx: Context, serverFlag: string | undefined) {
  const { ACTIONS_ID_TOKEN_REQUEST_URL: url, ACTIONS_ID_TOKEN_REQUEST_TOKEN: requestToken } =
    ctx.env;
  const server = serverFlag ?? ctx.env.BEMMOLY_PIPELINES_URL;
  if (ctx.env.BEMMOLY_PIPELINES_TOKEN || !url || !requestToken || !server) return undefined;
  return githubOidcToken({
    requestUrl: url,
    requestToken,
    audience: server.replace(/\/+$/, ''),
    ...(ctx.fetch ? { fetch: ctx.fetch } : {}),
  });
}
