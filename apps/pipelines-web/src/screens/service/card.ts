/** The service page's cards: one surface, one rule, one elevation, as the side cards draw. */
export const CARD =
  'flex flex-col gap-3 rounded-card border border-line bg-card px-4 py-3.5 shadow-e1';

/** Cloud Run's console for a service in a project, or null when the environment has none. */
export function cloudRunUrl(project: string | null, region: string | null, service: string) {
  if (!project || !region) return null;
  return `https://console.cloud.google.com/run/detail/${encodeURIComponent(region)}/${encodeURIComponent(service)}?project=${encodeURIComponent(project)}`;
}

/** Cloud Logging, filtered to the service's revisions in that project. */
export function cloudLoggingUrl(project: string | null, service: string) {
  if (!project) return null;
  const query = `resource.type="cloud_run_revision"\nresource.labels.service_name="${service}"`;
  return `https://console.cloud.google.com/logs/query;query=${encodeURIComponent(query)}?project=${encodeURIComponent(project)}`;
}
