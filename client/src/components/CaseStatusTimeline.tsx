import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, MessageSquare, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  id: number;
  eventType: string;
  title?: string;
  content?: string;
  visibility?: string;
  createdAt: Date;
  author?: { name: string };
}

interface CaseStatusTimelineProps {
  events: TimelineEvent[];
  isLoading: boolean;
}

export function CaseStatusTimeline({ events, isLoading }: CaseStatusTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="py-12 text-center">
        <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No case updates yet</p>
      </div>
    );
  }

  // Filter to only show shared events for clients
  const visibleEvents = events.filter(
    (e) => e.visibility !== "internal" || e.eventType === "status_change"
  );

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {visibleEvents.map((event) => (
          <div key={event.id} className="flex gap-4 relative">
            {/* Timeline dot */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                event.eventType === "status_change"
                  ? "bg-blue-100 border border-blue-200"
                  : event.eventType === "document_upload"
                  ? "bg-amber-100 border border-amber-200"
                  : event.eventType === "message"
                  ? "bg-teal-100 border border-teal-200"
                  : "bg-muted border border-border"
              }`}
            >
              {event.eventType === "status_change" && (
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              )}
              {event.eventType === "document_upload" && (
                <FileText className="w-4 h-4 text-amber-600" />
              )}
              {event.eventType === "message" && (
                <MessageSquare className="w-4 h-4 text-teal-600" />
              )}
              {!["status_change", "document_upload", "message"].includes(
                event.eventType
              ) && <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>

            {/* Event card */}
            <div className="flex-1 min-w-0 bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {event.title ||
                      (event.eventType === "status_change"
                        ? "Case Status Updated"
                        : event.eventType === "document_upload"
                        ? "Document Shared"
                        : event.eventType === "message"
                        ? "New Message"
                        : event.eventType)}
                  </p>
                  {event.content && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {event.content}
                    </p>
                  )}
                </div>
                {event.eventType === "status_change" && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 shrink-0">
                    Status Change
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(new Date(event.createdAt), "dd MMM yyyy, HH:mm")}</span>
                {event.author && <span>• {event.author.name}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
