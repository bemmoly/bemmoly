import manifest from '../../package.json' with { type: 'json' };

/** The application version recorded on every changelog row this process applies. */
export const APP_VERSION: string = manifest.version;
