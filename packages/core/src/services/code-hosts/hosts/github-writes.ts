import { z } from 'zod';
import { HttpStatusError } from '../../../clients/http-json.ts';
import type { RestClient } from '../../../clients/rest.ts';
import type {
  CodeCheckReport,
  CodeDeploymentReport,
  CodePullRequestInput,
} from '../../../contracts/code-hosts.ts';

/*
 * The writes and reads modules make on GitHub: checks (the Checks API, one check run per
 * name and commit, updated in place), deployments (the Deployments API and its statuses),
 * file contents and trees, and bot pull requests (a branch, one commit per file, a pull
 * request; an existing branch or pull request is reused, so a retry changes nothing).
 */

const idSchema = z.object({ id: z.number() });
const contentSchema = z.object({ content: z.string(), encoding: z.string(), sha: z.string() });
const treeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
  truncated: z.boolean().default(false),
});
const refSchema = z.object({ object: z.object({ sha: z.string() }) });
const pullSchema = z.object({ number: z.number().int(), html_url: z.string() });

const path = (value: string) => value.split('/').map(encodeURIComponent).join('/');
const notFound = (error: unknown) => error instanceof HttpStatusError && error.status === 404;
const exists = (error: unknown) => error instanceof HttpStatusError && error.status === 422;

export function githubWrites(client: () => Promise<RestClient>) {
  async function fileSha(repository: string, file: string, ref: string): Promise<string | null> {
    try {
      const answer = await (
        await client()
      ).getJson(`repos/${repository}/contents/${path(file)}`, {
        ref,
      });
      return contentSchema.parse(answer).sha;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  return {
    async reportCheck(report: CodeCheckReport) {
      const rest = await client();
      const body = {
        status: report.status,
        ...(report.conclusion ? { conclusion: report.conclusion } : {}),
        ...(report.detailsUrl ? { details_url: report.detailsUrl } : {}),
        ...(report.title
          ? { output: { title: report.title, summary: report.summary ?? report.title } }
          : {}),
      };
      const answer = report.externalId
        ? await rest.sendJson(
            'PATCH',
            `repos/${report.repository}/check-runs/${report.externalId}`,
            body,
          )
        : await rest.postJson(`repos/${report.repository}/check-runs`, {
            name: report.name,
            head_sha: report.headSha,
            ...body,
          });
      return { externalId: String(idSchema.parse(answer).id) };
    },

    async reportDeployment(report: CodeDeploymentReport) {
      const rest = await client();
      let id = report.externalId;
      if (!id) {
        const created = await rest.postJson(`repos/${report.repository}/deployments`, {
          ref: report.ref,
          environment: report.environment,
          auto_merge: false,
          // The release is already built and gated in Bemmoly; GitHub's own checks are not asked again.
          required_contexts: [],
          production_environment: report.production ?? false,
          ...(report.description ? { description: report.description } : {}),
        });
        id = String(idSchema.parse(created).id);
      }
      await rest.postJson(`repos/${report.repository}/deployments/${id}/statuses`, {
        state: report.state,
        ...(report.description ? { description: report.description.slice(0, 140) } : {}),
        ...(report.url ? { log_url: report.url } : {}),
      });
      return { externalId: id };
    },

    async readFile(repository: string, file: string, ref: string) {
      try {
        const answer = await (
          await client()
        ).getJson(`repos/${repository}/contents/${path(file)}`, {
          ref,
        });
        const content = contentSchema.parse(answer);
        return content.encoding === 'base64'
          ? Buffer.from(content.content, 'base64').toString('utf8')
          : content.content;
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },

    async listFiles(repository: string, ref: string) {
      const answer = await (
        await client()
      ).getJson(`repos/${repository}/git/trees/${encodeURIComponent(ref)}`, { recursive: 1 });
      const tree = treeSchema.parse(answer);
      return {
        paths: tree.tree.filter((item) => item.type === 'blob').map((item) => item.path),
        truncated: tree.truncated,
      };
    },

    async openPullRequest(input: CodePullRequestInput) {
      const rest = await client();
      const repo = input.repository;
      const base = refSchema.parse(
        await rest.getJson(`repos/${repo}/git/ref/heads/${path(input.baseBranch)}`),
      ).object.sha;
      try {
        await rest.postJson(`repos/${repo}/git/refs`, {
          ref: `refs/heads/${input.branch}`,
          sha: base,
        });
      } catch (error) {
        if (!exists(error)) throw error;
      }
      for (const file of input.files) {
        const sha = await fileSha(repo, file.path, input.branch);
        await rest.sendJson('PUT', `repos/${repo}/contents/${path(file.path)}`, {
          message: input.title,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          branch: input.branch,
          ...(sha ? { sha } : {}),
        });
      }
      try {
        const pull = pullSchema.parse(
          await rest.postJson(`repos/${repo}/pulls`, {
            title: input.title,
            head: input.branch,
            base: input.baseBranch,
            body: input.body,
          }),
        );
        return { url: pull.html_url, number: pull.number };
      } catch (error) {
        if (!exists(error)) throw error;
        const owner = repo.split('/')[0] ?? '';
        const open = z
          .array(pullSchema)
          .parse(
            await rest.getJson(`repos/${repo}/pulls`, {
              head: `${owner}:${input.branch}`,
              state: 'open',
            }),
          );
        const pull = open[0];
        if (!pull) throw error;
        return { url: pull.html_url, number: pull.number };
      }
    },
  };
}
