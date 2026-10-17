import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthSchema } from '../../../shared/common.ts';
import type {
  CloudProvider,
  DeployTarget,
  ReleaseArtifact,
} from '../services/providers/contract.ts';

/*
 * The conformance kit (architecture §14): what every provider's deploy target must do, the
 * same way, whatever the cloud. A provider's test file calls the describe function with a
 * factory; the factory returns null with a reason when the provider cannot run here (no
 * Docker, no recorded fixtures), and the kit skips rather than passing quietly.
 */

export interface TargetsSubject {
  provider: CloudProvider;
  target: DeployTarget;
  /** Two releases of the same application: the stable one and the one moving in. */
  stable: ReleaseArtifact;
  next: ReleaseArtifact;
  /** Waits until traffic has flowed long enough for metrics to exist, where that matters. */
  settle?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

const percentOf = (traffic: Array<{ revision: string; percent: number }>, revision: string) =>
  traffic.find((weight) => weight.revision === revision)?.percent ?? 0;

export function describeTargetsConformance(
  name: string,
  make: () => Promise<TargetsSubject | { skip: string }>,
): void {
  describe(`${name} deploy targets conform`, () => {
    let subject: TargetsSubject | undefined;
    let skip = '';
    let stableRevision = '';
    let nextRevision = '';

    beforeAll(async () => {
      const made = await make();
      if ('skip' in made) skip = made.skip;
      else subject = made;
    });

    afterAll(async () => {
      await subject?.cleanup?.();
    });

    const parts = () => {
      if (!subject?.provider.targets) throw new Error('The provider has no targets part');
      return { ...subject, targets: subject.provider.targets };
    };

    it('deploys a revision that takes no traffic yet', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target, stable } = parts();
      stableRevision = (await targets.deploy(target, stable)).revision;
      expect(stableRevision).toMatch(/\S/);
      const described = await targets.describe(target);
      expect(percentOf(described.traffic, stableRevision)).toBe(0);
    });

    it('sends every request to a revision shifted to 100%', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target } = parts();
      await targets.shift(target, { revision: stableRevision, percent: 100, stable: null });
      const described = await targets.describe(target);
      expect(percentOf(described.traffic, stableRevision)).toBe(100);
    });

    it('splits traffic between a canary and stable', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target, next } = parts();
      nextRevision = (await targets.deploy(target, next)).revision;
      expect(nextRevision).not.toBe(stableRevision);
      await targets.shift(target, { revision: nextRevision, percent: 25, stable: stableRevision });
      const described = await targets.describe(target);
      expect(percentOf(described.traffic, nextRevision)).toBe(25);
      expect(percentOf(described.traffic, stableRevision)).toBe(75);
    });

    it('reports health in the shared vocabulary', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target } = parts();
      expect(healthSchema.parse(await targets.health(target, nextRevision))).toBeTruthy();
    });

    it('measures each revision separately when it has metrics', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { provider, target } = parts();
      if (!provider.metrics) return ctx.skip(`${name} has no metrics part`);
      await subject.settle?.();
      const to = new Date();
      const window = { from: new Date(to.getTime() - 5 * 60e3), to };
      const canary = await provider.metrics.revision(target, nextRevision, 'error_rate', window);
      if (canary === null) return;
      expect(canary.requests).toBeGreaterThanOrEqual(0);
      if (canary.value !== null) expect(canary.value).toBeGreaterThanOrEqual(0);
    });

    it('rolls every request back to the previous revision at once', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target } = parts();
      await targets.rollback(target, stableRevision);
      const described = await targets.describe(target);
      expect(percentOf(described.traffic, stableRevision)).toBe(100);
      expect(percentOf(described.traffic, nextRevision)).toBe(0);
    });

    it('retires a revision without traffic and refuses one with traffic', async (ctx) => {
      if (!subject) return ctx.skip(skip);
      const { targets, target } = parts();
      await expect(targets.retire(target, stableRevision)).rejects.toThrow();
      await targets.retire(target, nextRevision);
      const described = await targets.describe(target);
      expect(percentOf(described.traffic, stableRevision)).toBe(100);
    });
  });
}
