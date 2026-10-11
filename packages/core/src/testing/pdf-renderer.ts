import { GenericContainer, getContainerRuntimeClient, Wait } from 'testcontainers';
import { createPdfRendererClient } from '../clients/pdf-renderer.ts';
import type { PdfRenderer } from '../contracts/pdf.ts';
import { adoptDockerCliContext } from './docker-context.ts';

/**
 * The PDF renderer the deploy kits run (ADR 0035), pinned by digest, started with the same
 * locked-down flags: no host resolves, nothing but data: and its own temp files loads, and
 * JavaScript is off. Keep these in step with deploy/compose and the Helm chart.
 */
export const PDF_RENDERER_IMAGE =
  'gotenberg/gotenberg:8.37.0-chromium@sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c';

export const PDF_RENDERER_COMMAND = [
  'gotenberg',
  '--api-timeout=60s',
  '--chromium-auto-start=true',
  '--chromium-disable-javascript=true',
  '--chromium-allow-list=^(file:///tmp/|data:)',
  '--chromium-deny-public-ips=true',
  '--chromium-deny-private-ips=true',
  '--chromium-host-resolver-rules=MAP * ~NOTFOUND',
  '--chromium-max-queue-size=8',
  '--chromium-restart-after=50',
  '--webhook-disable=true',
  '--prometheus-disable-collect=true',
];

const PORT = 3000;

export type TestPdfRenderer =
  | { available: true; renderer: PdfRenderer; stop(): Promise<void> }
  | { available: false; reason: string };

/** Starts the real renderer through Testcontainers, or says why it cannot. */
export async function startTestPdfRenderer(publicUrl: string): Promise<TestPdfRenderer> {
  adoptDockerCliContext();
  try {
    await getContainerRuntimeClient();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      reason: `Skipped: no container runtime for the renderer (${detail})`,
    };
  }
  const container = await new GenericContainer(PDF_RENDERER_IMAGE)
    .withCommand(PDF_RENDERER_COMMAND)
    .withExposedPorts(PORT)
    .withWaitStrategy(Wait.forHttp('/health', PORT).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();
  return {
    available: true,
    renderer: createPdfRendererClient({
      baseUrl: `http://${container.getHost()}:${container.getMappedPort(PORT)}`,
      publicUrl,
      timeoutMs: 60_000,
      maxHtmlBytes: 20 * 1024 * 1024,
      maxPdfBytes: 20 * 1024 * 1024,
    }),
    stop: async () => {
      await container.stop();
    },
  };
}
