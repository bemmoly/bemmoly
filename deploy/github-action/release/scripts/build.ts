import { build } from 'esbuild';
import { bundleOptions } from './bundle.ts';

await build(bundleOptions);
