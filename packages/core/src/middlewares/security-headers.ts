import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

export interface SecurityHeadersOptions {
  publicUrl: string;
}

const SELF = "'self'";
const TWO_YEARS_SECONDS = 63_072_000;

/**
 * Strict CSP (the browser talks only to this origin; AI providers are called
 * from the server), HSTS, and no framing anywhere.
 */
export const securityHeaders = fp<SecurityHeadersOptions>(
  async (app, options) => {
    const https = new URL(options.publicUrl).protocol === 'https:';
    await app.register(helmet, {
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: [SELF],
          baseUri: [SELF],
          connectSrc: [SELF],
          fontSrc: [SELF, 'data:'],
          formAction: [SELF],
          frameAncestors: ["'none'"],
          imgSrc: [SELF, 'data:', 'blob:'],
          manifestSrc: [SELF],
          objectSrc: ["'none'"],
          scriptSrc: [SELF],
          scriptSrcAttr: ["'none'"],
          styleSrc: [SELF],
          workerSrc: [SELF, 'blob:'],
          ...(https ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity: { maxAge: TWO_YEARS_SECONDS, includeSubDomains: true },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    });
  },
  { name: 'bemmoly-security-headers', fastify: '5.x' },
);
