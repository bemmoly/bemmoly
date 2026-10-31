import { LABELS } from '../gke-manifests.ts';

/*
 * The chart's templates for how many pods a revision runs, how secrets reach it as variables
 * and the name callers in the cluster use: the objects gke-scaling.ts and gke-secrets.ts write.
 */

const autoscaler = `{{- if .Values.application }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ .Values.revision }}
  minReplicas: {{ .Values.scaling.min }}
  maxReplicas: {{ .Values.scaling.max }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.scaling.cpuTarget }}
{{- end }}
`;

const budget = `{{- if and .Values.application .Values.disruptionBudget }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
spec:
  maxUnavailable: {{ .Values.disruptionBudget.maxUnavailable }}
  selector:
    matchLabels:
      ${LABELS.revision}: {{ .Values.revision }}
{{- end }}
`;

const secretSync = `{{- if and .Values.application .Values.secrets (eq .Values.secretsAs "env") }}
apiVersion: secret-sync.gke.io/v1
kind: SecretSync
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
spec:
  serviceAccountName: {{ .Values.serviceAccount }}
  secretProviderClassName: {{ .Values.revision }}
  secretObject:
    type: Opaque
    data:
      {{- range .Values.secrets }}
      - sourcePath: {{ .path | quote }}
        targetKey: {{ .path | quote }}
      {{- end }}
{{- end }}
`;

const stableService = `{{- if and .Values.application .Values.stableService }}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.stableService }}
  namespace: {{ .Release.Namespace }}
  labels:
    ${LABELS.application}: {{ .Values.application }}
    ${LABELS.managedBy}: {{ .Release.Service }}
spec:
  type: ClusterIP
  selector:
    ${LABELS.revision}: {{ .Values.revision }}
  ports:
    - name: http
      port: {{ .Values.port }}
      targetPort: {{ .Values.port }}
{{- end }}
`;

export const SCALING_TEMPLATES: Readonly<Record<string, string>> = {
  'horizontalpodautoscaler.yaml': autoscaler,
  'poddisruptionbudget.yaml': budget,
  'secretsync.yaml': secretSync,
  'stable-service.yaml': stableService,
};
