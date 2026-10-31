import { request as httpsRequest } from 'node:https';
import type { KubernetesTransport } from './http.ts';

/*
 * The real transport: HTTPS that trusts only the cluster's own certificate authority, which
 * GKE hands out with the cluster. Node's fetch cannot take a custom CA without another
 * dependency, so this speaks node:https and answers a fetch Response.
 */

/** `caPem` is the PEM text; GKE's API returns it base64 encoded, so decode it first. */
export function clusterTransport(caPem: string): KubernetesTransport {
  return (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const outgoing = httpsRequest(
        url,
        { method: init.method, headers: init.headers, ca: caPem, signal: init.signal },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('error', reject);
          incoming.on('end', () => {
            const status = incoming.statusCode ?? 502;
            const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
            resolve(new Response(body, { status }));
          });
        },
      );
      outgoing.on('error', reject);
      if (init.body !== undefined) outgoing.write(init.body);
      outgoing.end();
    });
}

/** GKE's `masterAuth.clusterCaCertificate` is the PEM, base64 encoded. */
export const pemFromBase64 = (value: string) => Buffer.from(value, 'base64').toString('utf8');
