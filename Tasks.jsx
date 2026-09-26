import { useState } from 'react';
import { Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/common/PageHeader';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskList from '@/components/tasks/TaskList';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import DeleteTaskDialog from '@/components/tasks/DeleteTaskDialog';
import useDebounce from '@/hooks/useDebounce';
import useTaskDialogs from '@/hooks/useTaskDialogs';
import { useTasks } from '@/hooks/useTasks';

const DEFAULT_FILTERS = { search: '', status: 'all', priority: 'all', sortBy: 'due_date' };

export default function Tasks() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const search = useDebounce(filters.search);
  const { data: tasks = [], isLoading, error, refetch } = useTasks({ ...filters, search });
  const dialogs = useTaskDialogs();
  const hasFilters = filters.search || filters.status !== 'all' || filters.priority !== 'all';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        eyebrow="Tasks"
        title="Everything on your plate"
        description={isLoading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
        action={
          <Button onClick={dialogs.openCreate} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> New task
          </Button>
        }
      />
      <TaskFilters filters={filters} onChange={setFilters} />
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onEdit={dialogs.openEdit}
        onDelete={dialogs.openDelete}
        emptyTitle={hasFilters ? 'No matching tasks' : 'No tasks yet'}
        emptyDescription={hasFilters ? 'Try a different search or clear your filters.' : 'Create your first task to get started.'}
        emptyAction={
          hasFilters ? (
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              <SearchX className="mr-1.5 h-4 w-4" /> Clear filters
            </Button>
          ) : (
            <Button onClick={dialogs.openCreate}>Create a task</Button>
          )
        }
      />
      <TaskFormDialog open={dialogs.formOpen} onOpenChange={dialogs.setFormOpen} task={dialogs.editing} />
      <DeleteTaskDialog task={dialogs.deleting} onOpenChange={dialogs.closeDelete} />
    </div>
  );
}
