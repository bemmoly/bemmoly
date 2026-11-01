{{/* The labels every object of one revision carries. */}}
{{- define "bemmoly.labels" -}}
app.kubernetes.io/name: {{ .Values.application }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
pipelines.bemmoly.dev/revision: {{ .Values.revision }}
{{- end }}
