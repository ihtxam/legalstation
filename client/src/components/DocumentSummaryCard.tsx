import { Loader, AlertCircle, CheckCircle, Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DocumentSummaryProps {
  summary?: {
    id: number;
    documentId: number;
    summary: string | null;
    keyPoints: string | null;
    sentiment: string | null;
    documentType: string | null;
    wordCount: number | null;
    readingTime: number | null;
    extractedEntities: string | null;
    status: "pending" | "analyzing" | "completed" | "failed";
    error: string | null;
    analyzedAt: Date | null;
  } | null;
  isLoading?: boolean;
}

export function DocumentSummaryCard({ summary, isLoading }: DocumentSummaryProps) {
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
            Analyzing Document...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  if (summary.status === "failed") {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{summary.error || "Unknown error occurred"}</p>
        </CardContent>
      </Card>
    );
  }

  if (summary.status === "pending" || summary.status === "analyzing") {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Loader className="w-4 h-4 animate-spin text-blue-600" />
            Analyzing Document...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-600">AI analysis in progress. This may take a moment.</p>
        </CardContent>
      </Card>
    );
  }

  // Parse JSON fields
  let keyPoints: string[] = [];
  let entities: any[] = [];

  try {
    if (summary.keyPoints) keyPoints = JSON.parse(summary.keyPoints);
    if (summary.extractedEntities) entities = JSON.parse(summary.extractedEntities);
  } catch (e) {
    console.error("Failed to parse summary data:", e);
  }

  const sentimentColors: Record<string, string> = {
    positive: "bg-green-100 text-green-700 border-green-200",
    neutral: "bg-gray-100 text-gray-700 border-gray-200",
    negative: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              AI Analysis Summary
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {summary.sentiment && (
              <Badge
                className={`text-xs ${sentimentColors[summary.sentiment] || sentimentColors.neutral}`}
              >
                {summary.sentiment}
              </Badge>
            )}
            {summary.documentType && (
              <Badge variant="outline" className="text-xs">
                {summary.documentType}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        {summary.summary && (
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary.summary}</p>
          </div>
        )}

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
              Key Points
            </p>
            <ul className="space-y-1">
              {keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-indigo-600 font-semibold shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Extracted Entities */}
        {entities.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              Important Details
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entities.slice(0, 5).map((entity, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {entity}
                </Badge>
              ))}
              {entities.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{entities.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 pt-2 border-t border-indigo-200">
          {summary.wordCount !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Word Count</p>
              <p className="text-sm font-medium text-foreground">{summary.wordCount}</p>
            </div>
          )}
          {summary.readingTime !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Reading Time</p>
              <p className="text-sm font-medium text-foreground">~{summary.readingTime} min</p>
            </div>
          )}
          {summary.analyzedAt && (
            <div className="ml-auto">
              <p className="text-xs text-muted-foreground">Analyzed</p>
              <p className="text-xs font-medium text-foreground">
                {new Date(summary.analyzedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
