export type FirmRole = "admin" | "lawyer" | "assistant" | "client";
export type CaseStatus = "open" | "pending" | "closed" | "archived";
export type CaseType = "civil" | "criminal" | "corporate" | "family" | "real_estate" | "employment" | "tax" | "immigration" | "intellectual_property" | "other";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type Visibility = "internal" | "shared";
export type ClientStatus = "invited" | "active" | "inactive";
export type ClientType = "individual" | "company";
export type BillingType = "hourly" | "flat_fee";
export type EventType = "note" | "status_change" | "document_upload" | "message" | "assignment" | "deadline" | "system";

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  civil: "Civil",
  criminal: "Criminal",
  corporate: "Corporate",
  family: "Family",
  real_estate: "Real Estate",
  employment: "Employment",
  tax: "Tax",
  immigration: "Immigration",
  intellectual_property: "Intellectual Property",
  other: "Other",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  pending: "Pending",
  closed: "Closed",
  archived: "Archived",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// Swiss VAT rates
export const SWISS_VAT_RATES = [
  { label: "Standard (7.7%)", value: 7.7 },
  { label: "Reduced (2.5%)", value: 2.5 },
  { label: "Special accommodation (3.7%)", value: 3.7 },
  { label: "Exempt (0%)", value: 0 },
] as const;
