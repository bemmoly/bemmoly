/** A tiny invalidation message; clients refetch through the REST API. */
export interface RealtimeMessage {
  kind: string;
  ids: readonly string[];
  projectId?: string;
  spaceId?: string;
}

export interface RealtimePublisher {
  publish(message: RealtimeMessage): Promise<void>;
}
