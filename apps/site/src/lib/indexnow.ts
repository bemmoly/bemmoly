/**
 * IndexNow (https://www.indexnow.org) tells Bing, Yandex, Naver, Seznam, Yep and DuckDuckGo
 * about changed URLs within minutes instead of waiting for a crawl. The key is public by
 * design: the protocol proves ownership by serving it at /<key>.txt on the site.
 * scripts/indexnow.ts submits every sitemap URL after a deploy.
 */
export const INDEXNOW_KEY = '90f5a73b6ab9cb1bf8ce66094fdaeb1c';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
