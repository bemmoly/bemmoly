import { describe, expect, it } from 'vitest';
import { cloudLoggingUrl, cloudRunUrl } from './card.ts';

describe('the console links', () => {
  it('opens Cloud Run and Cloud Logging for the service in its project', () => {
    expect(cloudRunUrl('shop-dev', 'europe-west1', 'api')).toBe(
      'https://console.cloud.google.com/run/detail/europe-west1/api?project=shop-dev',
    );
    expect(cloudLoggingUrl('shop-dev', 'api')).toContain('service_name%3D%22api%22');
    expect(cloudLoggingUrl('shop-dev', 'api')).toMatch(/\?project=shop-dev$/);
  });

  it('has no link for an environment without a project', () => {
    expect(cloudRunUrl(null, 'europe-west1', 'api')).toBeNull();
    expect(cloudLoggingUrl(null, 'api')).toBeNull();
  });
});
