import { connect, parse, SERVER_FLAGS, type Context } from '../cli/context.ts';
import { usageError } from '../cli/errors.ts';
import { createHttp } from '../clients/http.ts';
import { createPipelinesClient } from '../clients/pipelines.ts';
import { loadCredentials, removeCredentials, saveCredentials } from '../services/credentials.ts';
import { deviceSignIn } from '../clients/device.ts';

/*
 * bp login, logout and whoami. Login signs in with a device code by default; --token stores
 * an API token instead (for machines without a browser). Either way the token is checked
 * against the server before it is kept.
 */

export async function login(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values } = parse(argv, SERVER_FLAGS);
  const server = values.server ?? ctx.env.BEMMOLY_PIPELINES_URL;
  if (!server) throw usageError('Name the server: bp login --server https://bemmoly.acme.dev');
  const fetcher = ctx.fetch ? { fetch: ctx.fetch } : {};
  let token = values.token;
  let expiresAt: string | null = null;
  if (!token) {
    const signedIn = await deviceSignIn({
      http: createHttp({ baseUrl: server, ...fetcher }),
      deviceName: `bp on ${ctx.hostname}`,
      sleep: ctx.sleep,
      now: ctx.now,
      prompt: (authorization) => {
        ctx.output.out(
          `Open ${authorization.verification_uri} and enter ${authorization.user_code}`,
        );
        if (authorization.verification_uri_complete) {
          ctx.output.out(`or open ${authorization.verification_uri_complete}`);
        }
        ctx.output.out('Waiting for you to approve it…');
      },
    });
    token = signedIn.token;
    expiresAt = signedIn.expiresAt;
  }
  const me = await createPipelinesClient(createHttp({ baseUrl: server, token, ...fetcher })).me();
  if (!me.modules.includes('pipelines')) {
    ctx.output.err(
      `${me.user.name} may not use Pipelines on ${server} yet; ask an admin for access.`,
    );
  }
  const path = await saveCredentials(ctx.env.configDir, {
    server,
    token,
    name: me.user.name,
    email: me.user.email,
    source: values.token ? 'token' : 'device',
    expiresAt,
  });
  ctx.output.out(`Signed in to ${server} as ${me.user.name} (${me.user.email}).`);
  ctx.output.out(`Saved in ${path}.`);
  return 0;
}

export async function logout(ctx: Context, argv: readonly string[]): Promise<number> {
  parse(argv, {});
  const removed = await removeCredentials(ctx.env.configDir);
  ctx.output.out(
    removed
      ? 'Signed out. The token stays valid until it is revoked in Settings › API tokens.'
      : 'Not signed in.',
  );
  return 0;
}

export async function whoami(ctx: Context, argv: readonly string[]): Promise<number> {
  const { values } = parse(argv, SERVER_FLAGS);
  if (!values.server && !values.token && !ctx.env.BEMMOLY_PIPELINES_TOKEN) {
    const stored = await loadCredentials(ctx.env.configDir);
    if (!stored) {
      ctx.output.out('Not signed in. Run "bp login".');
      return 1;
    }
  }
  const { client, server } = await connect(ctx, values);
  const me = await client.me();
  ctx.output.out(`${me.user.name} (${me.user.email}) on ${server}`);
  return 0;
}
