import backupsTable from '../../../changelog/0300-backups.ts';
import type { Changelog } from '../../contracts/changelog.ts';

/** The system service's changesets (ids 0300–0399 of the kernel changelog). */
export const SYSTEM_CHANGESETS: Changelog = [backupsTable];
