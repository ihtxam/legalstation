export type CalendarProvider = "google" | "microsoft" | "icloud";
export type SyncDirection = "both" | "push" | "pull";

export type AgendaEntityType =
  | "case_deadline"
  | "case_task"
  | "client_activity"
  | "personal"
  | "imported";

export type AgendaItem = {
  id: string;
  entityType: AgendaEntityType;
  entityId: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  sourceLabel?: string;
  caseId?: number | null;
  provider?: CalendarProvider | null;
};

export type ExternalCalendarEvent = {
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  etag?: string | null;
  updatedAt?: Date | null;
};

export type UpsertExternalEventInput = {
  externalId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

export interface CalendarProviderClient {
  listEvents(from: Date, to: Date): Promise<ExternalCalendarEvent[]>;
  upsertEvent(input: UpsertExternalEventInput): Promise<{ externalId: string; etag?: string }>;
  deleteEvent(externalId: string): Promise<void>;
}
