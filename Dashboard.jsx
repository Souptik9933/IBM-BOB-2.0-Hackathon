import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import StatsGrid from '@/components/dashboard/StatsGrid';
import UpcomingTasks from '@/components/dashboard/UpcomingTasks';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import DeleteTaskDialog from '@/components/tasks/DeleteTaskDialog';
import useTaskDialogs from '@/hooks/useTaskDialogs';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const dialogs = useTaskDialogs();
  const firstName = user?.full_name?.split(' ')[0];
  const newButton = (
    <Button onClick={dialogs.openCreate} className="rounded-xl">
      <Plus className="mr-1.5 h-4 w-4" /> New task
    </Button>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Here's where your studies stand today."
        action={newButton}
      />
      <StatsGrid />
      <UpcomingTasks onEdit={dialogs.openEdit} onDelete={dialogs.openDelete} emptyAction={newButton} />
      <TaskFormDialog open={dialogs.formOpen} onOpenChange={dialogs.setFormOpen} task={dialogs.editing} />
      <DeleteTaskDialog task={dialogs.deleting} onOpenChange={dialogs.closeDelete} />
    </div>
  );
}
