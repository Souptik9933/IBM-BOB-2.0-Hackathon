import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/common/EmptyState';
import TaskMeta from '@/components/tasks/TaskMeta';
import TaskCheckbox from '@/components/tasks/TaskCheckbox';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import DeleteTaskDialog from '@/components/tasks/DeleteTaskDialog';
import useTaskDialogs from '@/hooks/useTaskDialogs';
import { useTask } from '@/hooks/useTasks';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: task, isLoading, error } = useTask(id);
  const dialogs = useTaskDialogs();

  const back = (
    <Link to="/tasks" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to tasks
    </Link>
  );

  if (isLoading) {
    return <div>{back}<Skeleton className="h-10 w-2/3 rounded-xl" /><Skeleton className="mt-6 h-64 w-full rounded-2xl" /></div>;
  }

  if (error || !task) {
    return <div>{back}<EmptyState icon={FileQuestion} title="Task not found" description="It may have been deleted, or the link is incorrect." /></div>;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {back}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="mt-2"><TaskCheckbox task={task} size="lg" /></div>
          <h1 className={`font-display text-3xl font-medium tracking-tight sm:text-4xl ${task.completed ? 'text-muted-foreground line-through' : ''}`}>
            {task.title}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => dialogs.openEdit(task)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" className="rounded-xl text-destructive hover:text-destructive" onClick={() => dialogs.openDelete(task)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Description</h2>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed">
            {task.description || <span className="text-muted-foreground">No description added.</span>}
          </p>
        </section>
        <TaskMeta task={task} />
      </div>
      <TaskFormDialog open={dialogs.formOpen} onOpenChange={dialogs.setFormOpen} task={dialogs.editing} />
      <DeleteTaskDialog task={dialogs.deleting} onOpenChange={dialogs.closeDelete} onDeleted={() => navigate('/tasks')} />
    </div>
  );
}
