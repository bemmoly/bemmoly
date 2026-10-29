import { stringify } from 'yaml';
import type { ExportFile, ExportPool } from '../../export-contract.ts';
import { POOL_LABEL, RUNNER_SERVICE_ACCOUNT } from '../autopilot-manifests.ts';
import { LABELS } from '../gke-manifests.ts';

/*
 * What a GKE Autopilot runner pool keeps on its cluster, as Helm: the pool's namespace and
 * the Kubernetes service account its pods run as, annotated with the Google service account
 * Workload Identity lets them act as. One release per pool, installed into its namespace.
 * The pods start and end with each job, and the warm room follows the pool's size, so both
 * stay with whoever starts the jobs.
 */

export const RUNNER_POOLS_CHART = 'runner-pools';

const labels = `    ${LABELS.managedBy}: {{ .Release.Service }}
    ${POOL_LABEL}: {{ .Values.pool }}`;

const namespace = `{{- if .Values.pool }}
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Release.Namespace }}
  labels:
${labels}
{{- end }}
`;

const serviceAccount = `{{- if .Values.pool }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${RUNNER_SERVICE_ACCOUNT}
  namespace: {{ .Release.Namespace }}
  labels:
${labels}
  annotations:
    iam.gke.io/gcp-service-account: {{ .Values.serviceAccount }}
{{- end }}
`;

const chart = `apiVersion: v2
name: ${RUNNER_POOLS_CHART}
description: What each GKE Autopilot runner pool keeps on its cluster, as Bemmoly Pipelines made it.
type: application
version: 0.1.0
`;

const defaults = `# Defaults. Each file under values/ is one pool; install it into the pool's namespace.
pool: ""
serviceAccount: ""
`;

export function poolFiles(pools: readonly ExportPool[]): ExportFile[] {
  const autopilot = pools.filter((pool) => pool.kind === 'gke-autopilot');
  if (autopilot.length === 0) return [];
  const root = `helm/${RUNNER_POOLS_CHART}`;
  return [
    { path: `${root}/Chart.yaml`, content: chart },
    { path: `${root}/values.yaml`, content: defaults },
    { path: `${root}/templates/namespace.yaml`, content: namespace },
    { path: `${root}/templates/serviceaccount.yaml`, content: serviceAccount },
    ...autopilot.map((pool) => ({
      path: `${root}/values/${pool.key}.yaml`,
      content:
        `# The ${pool.key} pool: install into ${pool.namespace} on ${pool.cluster.name}.\n` +
        stringify({ pool: pool.key, serviceAccount: pool.serviceAccount }),
    })),
  ];
}
