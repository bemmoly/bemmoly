{{- define "bemmoly.name" -}}
{{- .Release.Name | trunc 50 | trimSuffix "-" -}}
{{- end -}}

{{- define "bemmoly.labels" -}}
app.kubernetes.io/name: bemmoly
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "bemmoly.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end -}}

{{/* The Secret every pod reads its environment from: the user's, or the generated one. */}}
{{- define "bemmoly.secretName" -}}
{{- .Values.existingSecret | default (printf "%s-secrets" (include "bemmoly.name" .)) -}}
{{- end -}}

{{- define "bemmoly.postgresHost" -}}
{{- printf "%s-postgres" (include "bemmoly.name" .) -}}
{{- end -}}

{{- define "bemmoly.pdfHost" -}}
{{- printf "%s-pdf" (include "bemmoly.name" .) -}}
{{- end -}}

{{/* Changesets at boot; the 0.11 chart called this autoMigrate, which still wins when set. */}}
{{- define "bemmoly.migrateAtBoot" -}}
{{- if hasKey .Values "autoMigrate" -}}{{ .Values.autoMigrate }}{{- else -}}{{ .Values.migrations.atBoot }}{{- end -}}
{{- end -}}

{{- define "bemmoly.accessMode" -}}
{{- .Values.persistence.accessMode | default (ternary "ReadWriteMany" "ReadWriteOnce" (eq .Values.mode "split")) -}}
{{- end -}}

{{/* Fails the render with the fix when the values cannot work. */}}
{{- define "bemmoly.validate" -}}
{{- if not (has .Values.mode (list "all" "split")) -}}
{{- fail (printf "mode must be all or split (got %s)" .Values.mode) -}}
{{- end -}}
{{- if and .Values.postgresql.enabled .Values.externalDatabase.url -}}
{{- fail "Set either postgresql.enabled=true or externalDatabase.url, not both." -}}
{{- end -}}
{{- if not (or .Values.existingSecret .Values.postgresql.enabled .Values.externalDatabase.url) -}}
{{- fail "Choose a database: --set postgresql.enabled=true (bundled Postgres 18 with pgvector), --set externalDatabase.url=postgres://..., or --set existingSecret=<Secret with DATABASE_URL and BEMMOLY_SECRET_KEY>. Charts before 0.12 defaulted existingSecret to \"bemmoly\"; pass it explicitly when upgrading such a release." -}}
{{- end -}}
{{- if and .Values.existingSecret .Values.externalDatabase.url -}}
{{- fail "externalDatabase.url is written to the generated Secret; with existingSecret, put DATABASE_URL in that Secret instead." -}}
{{- end -}}
{{- if not (regexMatch "^https?://" .Values.publicUrl) -}}
{{- fail (printf "publicUrl must start with https:// or http:// (got %s)" .Values.publicUrl) -}}
{{- end -}}
{{- end -}}

{{/* Environment shared by the app pods and the migration Job. */}}
{{- define "bemmoly.env" -}}
- name: BEMMOLY_PUBLIC_URL
  value: {{ .Values.publicUrl | quote }}
- name: BEMMOLY_MODULES
  value: {{ .Values.modules | quote }}
- name: BEMMOLY_TRUST_PROXY
  value: "true"
{{- if .Values.pdf.enabled }}
- name: BEMMOLY_PDF_URL
  value: {{ printf "http://%s:3000" (include "bemmoly.pdfHost" .) | quote }}
- name: BEMMOLY_PDF_TIMEOUT_MS
  value: {{ mul .Values.pdf.timeoutSeconds 1000 | quote }}
- name: BEMMOLY_PDF_MAX_BYTES
  value: {{ .Values.pdf.maxBytes | int | quote }}
{{- end }}
{{- with .Values.extraEnv }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "bemmoly.envFrom" -}}
- secretRef:
    name: {{ include "bemmoly.secretName" . }}
{{- with .Values.extraEnvFrom }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "bemmoly.podSecurityContext" -}}
runAsUser: 10001
runAsGroup: 10001
runAsNonRoot: true
fsGroup: 10001
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "bemmoly.containerSecurityContext" -}}
allowPrivilegeEscalation: false
capabilities:
  drop: [ALL]
{{- end -}}
