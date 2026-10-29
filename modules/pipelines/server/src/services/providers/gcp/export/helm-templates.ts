import { GATEWAY_CLASS, GATEWAY_NAME, LABELS, SERVICE_PORT } from '../gke-manifests.ts';
import { SECRETS_DRIVER, SECRET_MOUNT, SECRET_VOLUME } from '../gke-secrets.ts';

/*
 * The chart's templates: the objects gke-manifests.ts and gke-secrets.ts write for one
 * revision, as Helm templates. One release renders one application from its values file; the
 * group's Gateway is its own release. Objects are labelled managed-by Helm, so Pipelines no
 * longer finds them as its own once Helm owns them.
 */

const helpers = `{{/* The labels every object of one revision carries. */}}
{{- define "bemmoly.labels" -}}
${LABELS.application}: {{ .Values.application }}
${LABELS.managedBy}: {{ .Release.Service }}
${LABELS.revision}: {{ .Values.revision }}
{{- end }}
`;

const deployment = `{{- if .Values.application }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
  annotations:
    ${LABELS.release}: {{ .Values.release | quote }}
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels:
      ${LABELS.revision}: {{ .Values.revision }}
  template:
    metadata:
      labels:
        {{- include "bemmoly.labels" . | nindent 8 }}
    spec:
      {{- if .Values.serviceAccount }}
      serviceAccountName: {{ .Values.serviceAccount }}
      {{- end }}
      containers:
        - name: {{ .Values.application }}
          image: {{ .Values.image | quote }}
          ports:
            - name: http
              containerPort: {{ .Values.port }}
          {{- with .Values.env }}
          env:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- if .Values.secrets }}
          volumeMounts:
            - name: ${SECRET_VOLUME}
              mountPath: ${SECRET_MOUNT}
              readOnly: true
          {{- end }}
          {{- with .Values.resources }}
          resources:
            requests:
              {{- toYaml . | nindent 14 }}
            limits:
              {{- toYaml . | nindent 14 }}
          {{- end }}
          {{- with .Values.healthcheck }}
          readinessProbe:
            httpGet:
              path: {{ .path }}
              port: {{ $.Values.port }}
            timeoutSeconds: {{ .timeoutSeconds }}
            periodSeconds: {{ max 10 .timeoutSeconds }}
          {{- end }}
      {{- if .Values.secrets }}
      volumes:
        - name: ${SECRET_VOLUME}
          csi:
            driver: ${SECRETS_DRIVER}
            readOnly: true
            volumeAttributes:
              secretProviderClass: {{ .Values.revision }}
      {{- end }}
{{- end }}
`;

const service = `{{- if .Values.application }}
apiVersion: v1
kind: Service
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    ${LABELS.revision}: {{ .Values.revision }}
  ports:
    - name: http
      port: ${SERVICE_PORT}
      targetPort: {{ .Values.port }}
{{- end }}
`;

const route = `{{- if .Values.application }}
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ .Values.application }}
  namespace: {{ .Release.Namespace }}
  labels:
    ${LABELS.application}: {{ .Values.application }}
    ${LABELS.managedBy}: {{ .Release.Service }}
spec:
  parentRefs:
    - name: {{ .Values.route.parent.name }}
      namespace: {{ .Values.route.parent.namespace | default .Release.Namespace }}
  hostnames:
    - {{ .Values.route.hostname | quote }}
  rules:
    - backendRefs:
        - name: {{ .Values.revision }}
          port: ${SERVICE_PORT}
          weight: 100
{{- end }}
`;

const secretClass = `{{- if and .Values.application .Values.secrets }}
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: {{ .Values.revision }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "bemmoly.labels" . | nindent 4 }}
spec:
  provider: gke
  parameters:
    secrets: |
      {{- range .Values.secrets }}
      - resourceName: {{ .resourceName | quote }}
        path: {{ .path | quote }}
      {{- end }}
{{- end }}
`;

const serviceAccount = `{{- if and .Values.application .Values.serviceAccount }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.serviceAccount }}
  namespace: {{ .Release.Namespace }}
  labels:
    ${LABELS.application}: {{ .Values.application }}
    ${LABELS.managedBy}: {{ .Release.Service }}
{{- end }}
`;

const gateway = `{{- if .Values.gateway.create }}
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ${GATEWAY_NAME}
  namespace: {{ .Release.Namespace }}
  labels:
    ${LABELS.managedBy}: {{ .Release.Service }}
spec:
  gatewayClassName: ${GATEWAY_CLASS}
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
{{- end }}
`;

export const TEMPLATES: Readonly<Record<string, string>> = {
  '_helpers.tpl': helpers,
  'deployment.yaml': deployment,
  'service.yaml': service,
  'httproute.yaml': route,
  'secretproviderclass.yaml': secretClass,
  'serviceaccount.yaml': serviceAccount,
  'gateway.yaml': gateway,
};

/** The chart's defaults: nothing renders until a values file names an application. */
export const DEFAULT_VALUES = `# Defaults. Each file under values/ is one application in one environment, or the group's
# Gateway; install each as its own release so applications release and roll back alone.
application: ""
revision: ""
release: ""
image: ""
port: 8080
replicas: 1
resources: {}
healthcheck: null
serviceAccount: ""
env: []
secrets: []
route:
  hostname: ""
  parent:
    name: ${GATEWAY_NAME}
    namespace: ""
gateway:
  create: false
`;
