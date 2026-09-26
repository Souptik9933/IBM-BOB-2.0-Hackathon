import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check,
  CheckCheck, CheckCircle2, ChevronDown, Circle, Clock3, Command,
  FileText, Filter, Flame, LayoutDashboard, ListTodo, MoreHorizontal,
  Pencil, Plus, Search, Sparkles, Target, Trash2, TrendingUp, X,
} from 'lucide-react';

const STORAGE_KEY = 'studywell.tasks.v1';
const PROFILE_KEY = 'studywell.profile.v1';
const priorityRank = { high: 0, medium: 1, low: 2 };
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDate = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return dateKey(date); };
const starterTasks = [
  { id: 'task-1', title: 'Read chapter 06: Data structures', course: 'Computer science', dueDate: shiftDate(0), priority: 'high', completed: false, description: 'Review linked lists and trees. Make a one-page summary of the key operations and their time complexity.' },
  { id: 'task-2', title: 'Problem set 04', course: 'Discrete mathematics', dueDate: shiftDate(0), priority: 'medium', completed: false, description: 'Complete questions 1 through 12. Show the proof steps for questions 8 and 11.' },
  { id: 'task-3', title: 'Draft project proposal', course: 'Design studio', dueDate: shiftDate(1), priority: 'high', completed: false, description: 'Write the problem statement, intended audience, and first pass at the project scope.' },
  { id: 'task-4', title: 'Watch lecture: Neural networks', course: 'Machine learning', dueDate: shiftDate(2), priority: 'low', completed: false, description: 'Watch the lecture and add notes to the shared study guide.' },
  { id: 'task-5', title: 'Submit lab report', course: 'Physics II', dueDate: shiftDate(-1), priority: 'medium', completed: true, description: 'Upload the final lab report and figures.' },
  { id: 'task-6', title: 'Review midterm flashcards', course: 'Computer science', dueDate: shiftDate(3), priority: 'low', completed: false, description: 'Do one pass through the algorithm and data structure decks.' },
];

function loadTasks() {
  try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(stored) ? stored : starterTasks; }
  catch { return starterTasks; }
}
function readRoute() { return decodeURIComponent(window.location.hash.replace(/^#\/?/, '') || 'overview'); }
function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en', options).format(new Date(`${value}T12:00:00`));
}
function dueLabel(value) {
  if (!value) return 'No due date';
  if (value < dateKey(new Date())) return `Overdue · ${formatDate(value)}`;
  if (value === dateKey(new Date())) return 'Due today';
  if (value === shiftDate(1)) return 'Due tomorrow';
  return formatDate(value, { weekday: 'short', month: 'short', day: 'numeric' });
}

function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile] = useState(() => localStorage.getItem(PROFILE_KEY) || 'Alex Morgan');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem(PROFILE_KEY, profile), [profile]);

  const navigate = (nextRoute) => { window.location.hash = `/${nextRoute}`; };
  const selectedTask = route.startsWith('task/') ? tasks.find((task) => task.id === route.slice(5)) : null;
  const openTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);
  const dueToday = openTasks.filter((task) => task.dueDate === dateKey(new Date())).length;
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < dateKey(new Date())).length;
  const completion = tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0;
  const firstName = profile.trim().split(/\s+/)[0] || 'there';

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...tasks].filter((task) => {
      const matchesSearch = !query || `${task.title} ${task.course} ${task.description}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'open' ? !task.completed : task.completed);
      return matchesSearch && matchesStatus && (priorityFilter === 'all' || task.priority === priorityFilter);
    }).sort((a, b) => {
      if (sortBy === 'priority') return priorityRank[a.priority] - priorityRank[b.priority] || (a.dueDate || '').localeCompare(b.dueDate || '');
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
  }, [tasks, search, statusFilter, priorityFilter, sortBy]);

  const saveTask = (draft) => {
    if (modal?.task) setTasks((current) => current.map((task) => task.id === modal.task.id ? { ...task, ...draft } : task));
    else setTasks((current) => [{ ...draft, id: crypto.randomUUID(), completed: false }, ...current]);
    setModal(null);
  };
  const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
  const deleteTask = (id) => { setTasks((current) => current.filter((task) => task.id !== id)); if (route === `task/${id}`) navigate('tasks'); setModal(null); };

  const renderTaskRow = (task, compact = false) => (
    <article className={`task-row${task.completed ? ' is-complete' : ''}${compact ? ' compact' : ''}`} key={task.id}>
      <button className="task-check" aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)}>{task.completed ? <Check size={15} strokeWidth={2.5} /> : <span />}</button>
      <button className="task-copy" onClick={() => navigate(`task/${task.id}`)}><span className="task-title">{task.title}</span><span className="task-course"><BookOpen size={13} /> {task.course}</span></button>
      <span className={`priority priority-${task.priority}`}><i />{task.priority}</span>
      <span className={`task-due${task.dueDate < dateKey(new Date()) && !task.completed ? ' overdue' : ''}`}><CalendarDays size={14} />{task.completed ? 'Completed' : dueLabel(task.dueDate)}</span>
      <div className="row-actions"><button className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => setModal({ type: 'edit', task })}><Pencil size={15} /></button><button className="icon-button delete-action" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => setModal({ type: 'delete', task })}><Trash2 size={15} /></button></div>
    </article>
  );

  const pageHeading = (eyebrow, title, description, action) => <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h1>{title}<span className="heading-period">.</span></h1><p>{description}</p></div>{action}</div>;

  const renderOverview = () => {
    const part = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
    const upcoming = [...openTasks].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 4);
    return <>
      <div className="page-heading overview-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div><h1>Good {part}, {firstName}<span className="heading-period">.</span></h1><p>A little progress today adds up to a lot over time.</p></div><button className="button button-primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> New task</button></div>
      <div className="stat-grid"><Stat icon={<ListTodo size={18} />} tint="green" label="Tasks to do" value={openTasks.length} note={`${dueToday} due today`} /><Stat icon={<Clock3 size={18} />} tint="coral" label="Needs attention" value={overdue} note={`overdue ${overdue === 1 ? 'task' : 'tasks'}`} /><Stat icon={<CheckCheck size={18} />} tint="yellow" label="Completed" value={completedTasks.length} note={`${completion}% of your list`} /><Stat icon={<Target size={18} />} tint="blue" label="Weekly focus" value={<>{Math.min(completedTasks.length, 7)}<small> / 7</small></>} note={<span className="progress-track"><i style={{ width: `${Math.min(completedTasks.length / 7 * 100, 100)}%` }} /></span>} /></div>
      <div className="overview-columns"><section className="content-section"><div className="section-heading"><div><div className="section-kicker">YOUR NEXT STEPS</div><h2>Coming up</h2></div><button className="text-link" onClick={() => navigate('tasks')}>All tasks <ArrowRight size={15} /></button></div>{upcoming.length ? <div className="task-list">{upcoming.map((task) => renderTaskRow(task, true))}</div> : <EmptyState onCreate={() => setModal({ type: 'create' })} />}</section>
        <aside className="focus-panel"><div className="focus-panel-top"><span className="focus-mark"><Sparkles size={18} /></span><span className="section-kicker">A MOMENT TO RESET</span></div><h2>Small steps.<br />Clear mind.</h2><p>Pick one task, give it your attention, and let the rest wait its turn.</p><div className="focus-divider" /><div className="focus-foot"><span><Flame size={15} /> Your momentum</span><strong>{completedTasks.length ? `${completedTasks.length} done` : 'Start today'}</strong></div></aside></div>
      <section className="content-section course-section"><div className="section-heading"><div><div className="section-kicker">AT A GLANCE</div><h2>Your subjects</h2></div><button className="text-link" onClick={() => navigate('insights')}>View progress <ArrowRight size={15} /></button></div><CourseOverview tasks={tasks} onOpenTasks={() => navigate('tasks')} /></section>
    </>;
  };

  const renderTasks = () => <>
    {pageHeading('YOUR WORKSPACE', 'All tasks', `${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'} · ${completedTasks.length} completed`, <button className="button button-primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> New task</button>)}
    <section className="task-manager"><div className="task-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filter tasks by completion">{[['all', 'All tasks'], ['open', 'To do'], ['completed', 'Completed']].map(([value, label]) => <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)} role="tab" aria-selected={statusFilter === value}>{label}<span>{value === 'all' ? tasks.length : value === 'open' ? openTasks.length : completedTasks.length}</span></button>)}</div><div className="task-controls"><label className="select-control"><Filter size={15} /><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><ChevronDown size={13} /></label><label className="select-control sort-control"><ArrowDownUp size={15} /><select aria-label="Sort tasks" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="dueDate">Due date</option><option value="priority">Priority</option><option value="title">Title</option></select><ChevronDown size={13} /></label></div></div><div className="task-list full-task-list">{visibleTasks.length ? visibleTasks.map((task) => renderTaskRow(task)) : <EmptyState onCreate={() => setModal({ type: 'create' })} filtered={Boolean(search || statusFilter !== 'all' || priorityFilter !== 'all')} />}</div></section>
  </>;

  const renderDetail = () => selectedTask ? <>
    <button className="back-link" onClick={() => navigate('tasks')}><ArrowLeft size={16} /> Back to tasks</button>
    <div className="detail-heading"><button className={`detail-check${selectedTask.completed ? ' checked' : ''}`} aria-label="Toggle task completion" onClick={() => toggleTask(selectedTask.id)}>{selectedTask.completed ? <Check size={19} /> : <Circle size={21} />}</button><div className="detail-title"><div className="eyebrow"><span className="eyebrow-line" /> {selectedTask.course}</div><h1 className={selectedTask.completed ? 'struck' : ''}>{selectedTask.title}</h1></div><div className="detail-actions"><button className="button button-outline" onClick={() => setModal({ type: 'edit', task: selectedTask })}><Pencil size={15} /> Edit</button><button className="button button-quiet danger-button" onClick={() => setModal({ type: 'delete', task: selectedTask })}><Trash2 size={16} /><span>Delete</span></button></div></div>
    <div className="detail-grid"><section className="detail-description"><div className="section-kicker">TASK NOTES</div><h2>Description</h2><p>{selectedTask.description || 'No notes added yet.'}</p></section><aside className="detail-meta"><div className="section-kicker">DETAILS</div><MetaRow icon={<CalendarDays size={16} />} label="Due date" value={dueLabel(selectedTask.dueDate)} /><MetaRow icon={<Target size={16} />} label="Priority" value={<span className={`priority priority-${selectedTask.priority}`}><i />{selectedTask.priority}</span>} /><MetaRow icon={<BookOpen size={16} />} label="Subject" value={selectedTask.course} /><MetaRow icon={<CheckCircle2 size={16} />} label="Status" value={selectedTask.completed ? 'Completed' : 'In progress'} last /></aside></div>
  </> : <div className="not-found"><FileText size={28} /><h1>Task not found</h1><p>It may have been removed from your list.</p><button className="button button-outline" onClick={() => navigate('tasks')}><ArrowLeft size={16} /> Return to tasks</button></div>;

  const renderInsights = () => <>
    {pageHeading('YOUR MOMENTUM', 'Progress', 'Notice what’s moving forward, one task at a time.')}
    <div className="insights-summary"><div className="insight-total"><span className="stat-icon stat-icon-green"><TrendingUp size={18} /></span><div><span className="stat-label">Overall completion</span><strong>{completion}<small>%</small></strong></div><div className="large-progress"><i style={{ width: `${completion}%` }} /></div></div><div className="insight-number"><span className="stat-icon stat-icon-yellow"><CheckCheck size={18} /></span><span className="stat-label">Tasks completed</span><strong>{completedTasks.length}<small> / {tasks.length}</small></strong></div><div className="insight-number"><span className="stat-icon stat-icon-coral"><Clock3 size={18} /></span><span className="stat-label">Still in progress</span><strong>{openTasks.length}</strong></div></div>
    <section className="content-section insights-subjects"><div className="section-heading"><div><div className="section-kicker">BY SUBJECT</div><h2>Where your time goes</h2></div><button className="text-link" onClick={() => navigate('tasks')}>Open task list <ArrowRight size={15} /></button></div><CourseOverview tasks={tasks} onOpenTasks={() => navigate('tasks')} detailed /></section>
    <section className="encouragement"><span><Sparkles size={18} /></span><div><h2>Keep showing up.</h2><p>Progress is built from the small things you finish along the way.</p></div><span className="encouragement-count">{completedTasks.length} {completedTasks.length === 1 ? 'task' : 'tasks'} done</span></section>
  </>;

  const isDetail = route.startsWith('task/');
  const currentSection = isDetail ? 'tasks' : route;
  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => navigate('overview')} aria-label="Studywell home"><span className="brand-mark"><BookOpen size={18} /></span><span>studywell<span className="brand-period">.</span></span></button>
      <div className="workspace-switcher"><span className="workspace-avatar">A</span><span className="workspace-name"><strong>My workspace</strong><small>Personal planner</small></span><ChevronDown size={15} /></div><div className="nav-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation"><NavButton active={currentSection === 'overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => navigate('overview')} /><NavButton active={currentSection === 'tasks'} icon={<ListTodo size={18} />} label="My tasks" count={openTasks.length} onClick={() => navigate('tasks')} /><NavButton active={currentSection === 'insights'} icon={<TrendingUp size={18} />} label="Progress" onClick={() => navigate('insights')} /></nav>
      <div className="sidebar-bottom"><div className="week-card"><div className="week-card-top"><span>THIS WEEK</span><span><Flame size={14} /> {completedTasks.length}</span></div><div className="week-card-number">{Math.min(completedTasks.length, 7)}<small> / 7 tasks</small></div><div className="week-progress"><i style={{ width: `${Math.min(completedTasks.length / 7 * 100, 100)}%` }} /></div><p>Keep a steady pace. You’ve got this.</p></div><button className="profile-button" onClick={() => { const next = window.prompt('What name should we use?', profile); if (next?.trim()) setProfile(next.trim()); }}><span className="profile-avatar">{firstName.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{profile}</strong><small>Personal account</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    <main className="main-panel"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{isDetail ? 'Task details' : currentSection === 'overview' ? 'Overview' : currentSection === 'tasks' ? 'My tasks' : 'Progress'}</strong></div><div className="topbar-actions"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" /><kbd><Command size={11} /> K</kbd></label><span className="topbar-date"><CalendarDays size={15} /> {formatDate(dateKey(new Date()), { month: 'short', day: 'numeric' })}</span></div></header>
      <div className={`page-content${isDetail ? ' detail-content' : ''}`}>{currentSection === 'overview' ? renderOverview() : currentSection === 'tasks' && !isDetail ? renderTasks() : currentSection === 'insights' ? renderInsights() : renderDetail()}<footer className="page-footer"><span>Make room for what matters.</span><button onClick={() => navigate('overview')}>Studywell <ArrowRight size={13} /></button></footer></div>
    </main>
    {modal && <TaskModal modal={modal} onClose={() => setModal(null)} onSave={saveTask} onDelete={deleteTask} />}
  </div>;
}

function Stat({ icon, tint, label, value, note }) { return <section className={`stat-block${tint === 'blue' ? ' stat-progress' : ''}`}><span className={`stat-icon stat-icon-${tint}`}>{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-note">{note}</span></section>; }
function NavButton({ active, icon, label, count, onClick }) { return <button className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count > 0 && <small>{count}</small>}</button>; }
function EmptyState({ onCreate, filtered = false }) { return <div className="empty-state"><span><CheckCircle2 size={21} /></span><h3>{filtered ? 'No tasks match those filters' : 'A little room to begin'}</h3><p>{filtered ? 'Try a different search, or create a new task.' : 'Add your first task and give your week a starting point.'}</p><button className="button button-outline" onClick={onCreate}><Plus size={15} /> Add a task</button></div>; }
function CourseOverview({ tasks, onOpenTasks, detailed = false }) {
  const subjects = Array.from(new Set(tasks.map((task) => task.course))).map((course) => { const group = tasks.filter((task) => task.course === course); const done = group.filter((task) => task.completed).length; return { course, count: group.length, done, percent: group.length ? Math.round(done / group.length * 100) : 0 }; }).sort((a, b) => b.count - a.count).slice(0, detailed ? undefined : 3);
  if (!subjects.length) return <EmptyState onCreate={onOpenTasks} />;
  return <div className={`course-list${detailed ? ' detailed-course-list' : ''}`}>{subjects.map((subject, index) => <button className="course-row" key={subject.course} onClick={onOpenTasks}><span className={`course-marker marker-${index % 4}`}><BookOpen size={16} /></span><span className="course-name"><strong>{subject.course}</strong><small>{subject.done} of {subject.count} tasks complete</small></span><span className="course-progress"><i style={{ width: `${subject.percent}%` }} /></span><strong className="course-percent">{subject.percent}%</strong><ArrowRight className="course-arrow" size={15} /></button>)}</div>;
}
function MetaRow({ icon, label, value, last = false }) { return <div className={`meta-row${last ? ' last' : ''}`}><span className="meta-icon">{icon}</span><span className="meta-label">{label}</span><strong className="meta-value">{value}</strong></div>; }
function TaskModal({ modal, onClose, onSave, onDelete }) {
  if (modal.type === 'delete') return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button><span className="confirm-icon"><Trash2 size={19} /></span><div className="section-kicker">REMOVE TASK</div><h2 id="delete-title">Delete this task?</h2><p>“{modal.task.title}” will be removed from your workspace. This can’t be undone.</p><div className="modal-actions"><button className="button button-quiet" onClick={onClose}>Keep task</button><button className="button button-delete" onClick={() => onDelete(modal.task.id)}><Trash2 size={15} /> Delete task</button></div></section></div>;
  return <TaskEditor key={modal.task?.id || 'new'} task={modal.task} onClose={onClose} onSave={onSave} />;
}
function TaskEditor({ task, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [course, setCourse] = useState(task?.course || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || shiftDate(1));
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [description, setDescription] = useState(task?.description || '');
  const [error, setError] = useState('');
  const submit = (event) => { event.preventDefault(); if (!title.trim() || !course.trim()) { setError('Add a task name and subject to continue.'); return; } onSave({ title: title.trim(), course: course.trim(), dueDate, priority, description: description.trim(), completed: task?.completed || false }); };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="task-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="modal-header"><div><div className="section-kicker">{task ? 'MAKE AN UPDATE' : 'MAKE A PLAN'}</div><h2 id="task-modal-title">{task ? 'Edit task' : 'New task'}</h2></div><button type="button" className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div><div className="modal-fields"><label className="form-field"><span>Task name</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Read chapter 06" maxLength={120} /></label><div className="form-two-col"><label className="form-field"><span>Subject</span><input value={course} onChange={(event) => setCourse(event.target.value)} placeholder="e.g. Biology" maxLength={60} /></label><label className="form-field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><label className="form-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="form-field"><span>Notes <small>OPTIONAL</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a few details to help you get started..." rows={3} maxLength={500} /></label>{error && <p className="form-error">{error}</p>}</div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> {task ? 'Save changes' : 'Create task'}</button></div></form></div>;
}

export default App;