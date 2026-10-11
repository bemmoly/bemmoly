/**
 * Crawlers named in robots.txt. Every one is allowed; naming them means a bot that looks for
 * its own group finds an explicit welcome rather than falling through to the wildcard, and a
 * future exclusion is one line here, not a new file.
 */
export interface CrawlerGroup {
  label: string;
  agents: readonly string[];
}

export const CRAWLERS: readonly CrawlerGroup[] = [
  {
    label: 'Search engines',
    agents: [
      'Googlebot',
      'Googlebot-Image',
      'Storebot-Google',
      'Bingbot',
      'DuckDuckBot',
      'Applebot',
      'YandexBot',
      'Baiduspider',
      'Slurp',
      'Yeti',
      'SeznamBot',
      'Qwantbot',
      'MojeekBot',
      'PetalBot',
      'coccocbot-web',
      'Sogou web spider',
      'Bytespider',
    ],
  },
  {
    label: 'AI assistants and answer engines',
    agents: [
      'ChatGPT-User',
      'OAI-SearchBot',
      'ClaudeBot',
      'Claude-User',
      'Claude-SearchBot',
      'anthropic-ai',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'Applebot-Extended',
      'Meta-ExternalAgent',
      'Meta-ExternalFetcher',
      'Amazonbot',
      'DuckAssistBot',
      'YouBot',
      'MistralAI-User',
      'cohere-ai',
      'Diffbot',
      'Kagibot',
    ],
  },
  {
    label: 'Training and open crawls',
    agents: ['GPTBot', 'CCBot', 'omgili', 'Timpibot'],
  },
  {
    label: 'Link previews',
    agents: ['facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'Slackbot', 'Discordbot'],
  },
];
