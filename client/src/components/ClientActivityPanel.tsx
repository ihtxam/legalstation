import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

type ActivityType = "note" | "meeting" | "todo" | "next_action" | "reminder";

const TYPES: ActivityType[] = ["note", "meeting", "todo", "next_action", "reminder"];

export default function ClientActivityPanel({ clientId }: { clientId: number }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ActivityType>("note");
  const utils = trpc.useUtils();
  const { data: members } = trpc.firm.members.useQuery();
  const { data: activities, isLoading } = trpc.clientActivities.list.useQuery({
    clientId,
    type: tab,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");

  const create = trpc.clientActivities.create.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.activityCreated"));
      setTitle("");
      setBody("");
      setDueAt("");
      setRemindAt("");
      setAssigneeUserId("");
      await utils.clientActivities.list.invalidate({ clientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const complete = trpc.clientActivities.complete.useMutation({
    onSuccess: () => utils.clientActivities.list.invalidate({ clientId }),
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.clientActivities.delete.useMutation({
    onSuccess: () => {
      toast.success(t("crm.activityDeleted"));
      utils.clientActivities.list.invalidate({ clientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const typeLabel = (type: ActivityType) => {
    const map: Record<ActivityType, string> = {
      note: t("crm.notes"),
      meeting: t("crm.meetings"),
      todo: t("crm.todos"),
      next_action: t("crm.nextActions"),
      reminder: t("crm.reminders"),
    };
    return map[type];
  };

  const showComplete = tab === "todo" || tab === "next_action" || tab === "reminder";
  const showDue = tab !== "note";

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">{t("crm.activityTitle")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("crm.activityHint")}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ActivityType)}>
        <TabsList className="bg-muted flex flex-wrap h-auto">
          {TYPES.map((type) => (
            <TabsTrigger key={type} value={type} className="text-xs sm:text-sm">
              {typeLabel(type)}
            </TabsTrigger>
          ))}
        </TabsList>

        {TYPES.map((type) => (
          <TabsContent key={type} value={type} className="mt-4 space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
              <div>
                <Label>{t("crm.activityTitleField")}</Label>
                <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t("crm.body")}</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("crm.mentionHint")}
                />
                <p className="text-xs text-muted-foreground mt-1">{t("crm.mentionHint")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {showDue && (
                  <div>
                    <Label>{t("crm.dueDate")}</Label>
                    <Input
                      className="mt-1"
                      type="datetime-local"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  </div>
                )}
                {tab === "reminder" && (
                  <div>
                    <Label>{t("crm.remindAt")}</Label>
                    <Input
                      className="mt-1"
                      type="datetime-local"
                      value={remindAt}
                      onChange={(e) => setRemindAt(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label>{t("crm.assignee")}</Label>
                  <Select
                    value={assigneeUserId || "none"}
                    onValueChange={(v) => setAssigneeUserId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t("crm.unassigned")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("crm.unassigned")}</SelectItem>
                      {(members || []).map((m) => (
                        <SelectItem key={m.user.id} value={String(m.user.id)}>
                          {m.user.name || m.user.email} (@[{m.user.id}])
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-[var(--color-navy)] text-white"
                  disabled={!title.trim() || create.isPending}
                  onClick={() =>
                    create.mutate({
                      clientId,
                      type,
                      title: title.trim(),
                      body: body || undefined,
                      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                      remindAt: remindAt ? new Date(remindAt).toISOString() : null,
                      assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5 me-1.5" /> {t("crm.addActivity")}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : !activities?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("crm.noActivities")}</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    {showComplete && (
                      <Checkbox
                        className="mt-1"
                        checked={Boolean(a.completedAt)}
                        onCheckedChange={(checked) =>
                          complete.mutate({ id: a.id, completed: Boolean(checked) })
                        }
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          a.completedAt ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {a.title}
                      </p>
                      {a.body && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                          {a.body}
                        </p>
                      )}
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>{format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}</span>
                        {a.dueAt && (
                          <span>
                            {t("crm.dueDate")}: {format(new Date(a.dueAt), "dd MMM yyyy HH:mm")}
                          </span>
                        )}
                        {(a.assigneeName || a.assigneeUserId) && (
                          <span>
                            {a.assigneeName}
                            {a.assigneeUserId ? ` (@[${a.assigneeUserId}])` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive h-8 px-2"
                      onClick={() => remove.mutate({ id: a.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
