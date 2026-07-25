import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export default function CaseTasksPanel({ caseId }: { caseId: number }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.caseTasks.list.useQuery({ caseId });
  const { data: stages } = trpc.matterStages.list.useQuery();
  const { data: members } = trpc.firm.members.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [dueAt, setDueAt] = useState("");
  const [matterStageId, setMatterStageId] = useState<string>("");
  const [parentTaskId, setParentTaskId] = useState<string>("");

  const createTask = trpc.caseTasks.create.useMutation({
    onSuccess: async () => {
      toast.success(t("crm.taskCreated"));
      setTitle("");
      setDescription("");
      setAssigneeUserId("");
      setDueAt("");
      setMatterStageId("");
      setParentTaskId("");
      setShowForm(false);
      await utils.caseTasks.list.invalidate({ caseId });
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatus = trpc.caseTasks.setStatus.useMutation({
    onSuccess: () => utils.caseTasks.list.invalidate({ caseId }),
    onError: (e) => toast.error(e.message),
  });

  const deleteTask = trpc.caseTasks.delete.useMutation({
    onSuccess: () => {
      toast.success(t("crm.taskDeleted"));
      utils.caseTasks.list.invalidate({ caseId });
    },
    onError: (e) => toast.error(e.message),
  });

  const roots = useMemo(() => {
    if (!tasks) return [];
    const byParent = new Map<number | null, typeof tasks>();
    for (const task of tasks) {
      const key = task.parentTaskId ?? null;
      const list = byParent.get(key) || [];
      list.push(task);
      byParent.set(key, list);
    }
    const top = byParent.get(null) || [];
    return top.map((parent) => ({
      parent,
      children: byParent.get(parent.id) || [],
    }));
  }, [tasks]);

  const statusLabel = (s: TaskStatus) => {
    const map: Record<TaskStatus, string> = {
      todo: t("crm.statusTodo"),
      in_progress: t("crm.statusInProgress"),
      done: t("crm.statusDone"),
      cancelled: t("crm.statusCancelled"),
    };
    return map[s];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{t("crm.tasksHint")}</p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-3.5 h-3.5 me-1.5" /> {t("crm.addTask")}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
          <div>
            <Label>{t("crm.taskTitle")}</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>{t("crm.description")}</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("crm.mentionHint")}
            />
            <p className="text-xs text-muted-foreground mt-1">{t("crm.mentionHint")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("crm.assignee")}</Label>
              <Select value={assigneeUserId || "none"} onValueChange={(v) => setAssigneeUserId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("crm.unassigned")} /></SelectTrigger>
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
            <div>
              <Label>{t("crm.dueDate")}</Label>
              <Input className="mt-1" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <Label>{t("crm.matterStage")}</Label>
              <Select value={matterStageId || "none"} onValueChange={(v) => setMatterStageId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("crm.noStage")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("crm.noStage")}</SelectItem>
                  {(stages || []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("crm.parentTask")}</Label>
              <Select value={parentTaskId || "none"} onValueChange={(v) => setParentTaskId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("crm.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("crm.none")}</SelectItem>
                  {(tasks || []).filter((task) => !task.parentTaskId).map((task) => (
                    <SelectItem key={task.id} value={String(task.id)}>{task.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button
              className="bg-[var(--color-navy)] text-white"
              disabled={!title.trim() || createTask.isPending}
              onClick={() =>
                createTask.mutate({
                  caseId,
                  title: title.trim(),
                  description: description || undefined,
                  assigneeUserId: assigneeUserId ? Number(assigneeUserId) : null,
                  dueAt: dueAt || null,
                  matterStageId: matterStageId ? Number(matterStageId) : null,
                  parentTaskId: parentTaskId ? Number(parentTaskId) : null,
                })
              }
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !roots.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t("crm.noTasks")}</p>
      ) : (
        <ul className="space-y-2">
          {roots.map(({ parent, children }) => (
            <li key={parent.id} className="space-y-2">
              <TaskRow
                task={parent}
                indent={0}
                statusLabel={statusLabel}
                onStatus={(status) => setStatus.mutate({ id: parent.id, status })}
                onDelete={() => deleteTask.mutate({ id: parent.id })}
              />
              {children.map((child) => (
                <TaskRow
                  key={child.id}
                  task={child}
                  indent={1}
                  statusLabel={statusLabel}
                  onStatus={(status) => setStatus.mutate({ id: child.id, status })}
                  onDelete={() => deleteTask.mutate({ id: child.id })}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task,
  indent,
  statusLabel,
  onStatus,
  onDelete,
}: {
  task: {
    id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    dueAt: Date | string | null;
    assigneeName: string | null;
    assigneeUserId: number | null;
  };
  indent: number;
  statusLabel: (s: TaskStatus) => string;
  onStatus: (s: TaskStatus) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const done = task.status === "done";

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-border p-3 bg-card"
      style={{ marginInlineStart: indent ? 24 : 0 }}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onStatus(checked ? "done" : "todo")}
        className="mt-1"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-medium text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          <Badge variant="secondary" className="text-xs">{statusLabel(task.status)}</Badge>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {task.assigneeName || task.assigneeUserId ? (
            <span>
              {task.assigneeName || t("crm.assignee")}
              {task.assigneeUserId ? ` (@[${task.assigneeUserId}])` : ""}
            </span>
          ) : null}
          {task.dueAt && <span>{format(new Date(task.dueAt), "dd MMM yyyy")}</span>}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Select value={task.status} onValueChange={(v) => onStatus(v as TaskStatus)}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">{t("crm.statusTodo")}</SelectItem>
              <SelectItem value="in_progress">{t("crm.statusInProgress")}</SelectItem>
              <SelectItem value="done">{t("crm.statusDone")}</SelectItem>
              <SelectItem value="cancelled">{t("crm.statusCancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
