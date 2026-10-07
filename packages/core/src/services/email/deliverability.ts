import type { DeliverabilityCheck, DnsRecordCheck } from '@bemmoly/shared';
import { isIP } from 'node:net';
import type { TxtLookup } from '../../clients/dns.ts';

/** The domain part of the from address, or null when DNS checks make no sense (localhost). */
export function fromDomain(address: string): string | null {
  const domain = address.split('@')[1]?.toLowerCase();
  if (!domain || !domain.includes('.') || isIP(domain.replace(/^\[|\]$/g, ''))) return null;
  return domain;
}

async function txt(lookup: TxtLookup, name: string): Promise<string[] | null> {
  try {
    return await lookup(name);
  } catch {
    return null;
  }
}

function unknown(name: string): DnsRecordCheck {
  return {
    status: 'unknown',
    found: null,
    message: `The DNS lookup for ${name} failed, so this could not be checked. Try again later.`,
    suggested: null,
  };
}

async function checkSpf(
  lookup: TxtLookup,
  domain: string,
  smtpHost: string,
): Promise<DnsRecordCheck> {
  const records = await txt(lookup, domain);
  if (!records) return unknown(domain);
  const spf = records.filter((record) => /^v=spf1(\s|$)/i.test(record));
  const relay = smtpHost && !isIP(smtpHost) ? ` a:${smtpHost}` : '';
  const suggested = { host: domain, type: 'TXT' as const, value: `v=spf1 a mx${relay} ~all` };
  if (spf.length === 0) {
    return {
      status: 'missing',
      found: null,
      message: `${domain} has no SPF record, so receivers cannot tell whether this server may send for it. Add the record below, adjusted to the servers you send through.`,
      suggested,
    };
  }
  if (spf.length > 1) {
    return {
      status: 'invalid',
      found: spf.join(' | '),
      message: `${domain} has ${spf.length} SPF records; receivers treat that as none. Merge them into one record.`,
      suggested: null,
    };
  }
  const [record = ''] = spf;
  if (/\s\+all$/i.test(record)) {
    return {
      status: 'invalid',
      found: record,
      message:
        'The SPF record ends in +all, which lets any server send as this domain. Use ~all or -all.',
      suggested: { ...suggested, value: record.replace(/\+all$/i, '~all') },
    };
  }
  return {
    status: 'ok',
    found: record,
    message: `${domain} publishes an SPF record.`,
    suggested: null,
  };
}

async function checkDmarc(lookup: TxtLookup, domain: string): Promise<DnsRecordCheck> {
  const name = `_dmarc.${domain}`;
  const records = await txt(lookup, name);
  if (!records) return unknown(name);
  const dmarc = records.filter((record) => /^v=DMARC1(\s*;|$)/i.test(record));
  if (dmarc.length === 0) {
    return {
      status: 'missing',
      found: null,
      message: `${domain} has no DMARC record. Some providers now reject or junk mail without one.`,
      suggested: { host: name, type: 'TXT', value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}` },
    };
  }
  if (dmarc.length > 1) {
    return {
      status: 'invalid',
      found: dmarc.join(' | '),
      message: `${name} has ${dmarc.length} DMARC records; receivers ignore them all. Keep one.`,
      suggested: null,
    };
  }
  const [record = ''] = dmarc;
  const monitoring = /;\s*p=none/i.test(record);
  return {
    status: 'ok',
    found: record,
    message: monitoring
      ? `${domain} publishes DMARC in monitoring mode (p=none).`
      : `${domain} publishes a DMARC policy.`,
    suggested: null,
  };
}

/** SPF and DMARC for the from-domain, with the records to add when they are missing. */
export async function checkDeliverability(
  lookup: TxtLookup,
  fromAddress: string,
  smtpHost: string,
): Promise<DeliverabilityCheck | null> {
  const domain = fromDomain(fromAddress);
  if (!domain) return null;
  const [spf, dmarc] = await Promise.all([
    checkSpf(lookup, domain, smtpHost),
    checkDmarc(lookup, domain),
  ]);
  return { domain, spf, dmarc };
}
