import { describe, expect, it } from 'vitest';
import { renderGithubAppPage } from './github-app-page.ts';
import {
  githubCanReach,
  githubInstallUrl,
  githubManifest,
  githubManifestUrl,
} from './hosts/github-app.ts';

describe('GitHub App manifest', () => {
  it('posts to the admin’s own apps, or the organization’s, on github.com or the server', () => {
    expect(githubManifestUrl(null, null, 's')).toBe('https://github.com/settings/apps/new?state=s');
    expect(githubManifestUrl(null, 'acme', 's')).toBe(
      'https://github.com/organizations/acme/settings/apps/new?state=s',
    );
    expect(githubManifestUrl('https://git.acme.dev/', null, 'a+b')).toBe(
      'https://git.acme.dev/settings/apps/new?state=a%2Bb',
    );
  });

  it('installs from /apps on github.com and /github-apps on Enterprise Server', () => {
    expect(githubInstallUrl(null, 'bemmoly-acme')).toBe(
      'https://github.com/apps/bemmoly-acme/installations/new',
    );
    expect(githubInstallUrl('https://git.acme.dev', 'bemmoly-acme')).toBe(
      'https://git.acme.dev/github-apps/bemmoly-acme/installations/new',
    );
  });

  it('knows github.com reaches only public addresses, and a server anything but loopback', () => {
    expect(githubCanReach('https://bemmoly.acme.dev', null)).toBe(true);
    expect(githubCanReach('http://localhost:8080', null)).toBe(false);
    expect(githubCanReach('http://10.0.0.4', null)).toBe(false);
    expect(githubCanReach('https://bemmoly.acme.internal', null)).toBe(false);
    expect(githubCanReach('http://bemmoly', null)).toBe(false);
    expect(githubCanReach('http://10.0.0.4', 'https://git.acme.dev')).toBe(true);
    expect(githubCanReach('http://127.0.0.1:8080', 'https://git.acme.dev')).toBe(false);
  });

  it('asks for read access only, and subscribes to events only with a webhook', () => {
    const urls = {
      publicUrl: 'https://bemmoly.acme.dev',
      redirectUrl: 'https://bemmoly.acme.dev/settings/code-hosts',
      setupUrl: 'https://bemmoly.acme.dev/settings/code-hosts?installed=1',
    };
    const withHook = JSON.parse(
      githubManifest({ ...urls, webhookUrl: 'https://bemmoly.acme.dev/hook' }),
    );
    expect(withHook).toMatchObject({
      public: false,
      setup_on_update: true,
      hook_attributes: { url: 'https://bemmoly.acme.dev/hook', active: true },
    });
    expect(Object.values(withHook.default_permissions)).toEqual(['read', 'read', 'read', 'read']);
    expect(withHook.default_events).toContain('pull_request');
    expect(withHook.name.length).toBeLessThanOrEqual(34);
    const without = JSON.parse(githubManifest({ ...urls, webhookUrl: null }));
    expect(without.hook_attributes).toBeUndefined();
    expect(without.default_events).toEqual([]);
  });

  it('renders the handoff page with the manifest escaped and the form held to GitHub', () => {
    const page = renderGithubAppPage(
      'https://github.com/settings/apps/new?state=x',
      JSON.stringify({ name: '"><script>alert(1)</script>' }),
    );
    expect(page.html).not.toContain('<script>alert');
    expect(page.html).toContain('&#34;&#62;&#60;script&#62;');
    expect(page.contentSecurityPolicy).toContain('form-action https://github.com');
    expect(page.contentSecurityPolicy).toContain("default-src 'none'");
  });
});
