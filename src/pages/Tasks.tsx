import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, Loader2, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { Task } from '@/types';
import { TaskEditorDialog } from '@/components/TaskEditorDialog';
import { formatDateSafe } from '@/utils/date';
import { TaskBoard } from '@/components/TaskBoard';
import useLocalStorageState from '@/hooks/useLocalStorageState';

const priorityVariantMap: Record<Task['priority'], 'default' | 'secondary' | 'destructive'> = {
  'Low': 'secondary',
  'Medium': 'default',
  'High': 'destructive',
};

const Tasks = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useLocalStorageState<'list' | 'board'>('tasks-view-mode', 'list');

  const canCreate = usePermissions('tasks:create');
  const canEdit = usePermissions('tasks:edit');
  const canDelete = usePermissions('tasks:delete');

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => authenticatedFetch('/api/tasks'),
    enabled: !!profile,
  });

  const mutation = useMutation({
    mutationFn: ({ values, id }: { values: any, id?: string }) => {
      const url = id ? `/api/tasks/${id}` : '/api/tasks';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify(values) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Task updated!' : 'Task created!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditorOpen(false);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Task deleted!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleSave = (values: any, id?: string) => {
    mutation.mutate({ values, id });
  };

  const handleEdit = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedTask(null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tasks</CardTitle>
            <CardDescription>Manage and track your team's work.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'list' ? 'board' : 'list')}>
                  {viewMode === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Switch to {viewMode === 'list' ? 'Board' : 'List'} View</p></TooltipContent>
            </Tooltip>
            {canCreate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="gap-1" onClick={handleCreate}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Task</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Create a new task</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks && tasks.length > 0 ? (
                    tasks.map(task => (
                      <TableRow key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className="cursor-pointer">
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>{task.assignee_name || 'Unassigned'}</TableCell>
                        <TableCell>{formatDateSafe(task.due_date)}</TableCell>
                        <TableCell><Badge variant={priorityVariantMap[task.priority]}>{task.priority}</Badge></TableCell>
                        <TableCell>{task.status}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>More actions</p></TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent>
                              {canEdit && <DropdownMenuItem onClick={(e) => handleEdit(e, task)}>Edit</DropdownMenuItem>}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this task.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteMutation.mutate(task.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No tasks found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <TaskBoard tasks={tasks || []} />
          )}
        </CardContent>
      </Card>
      <TaskEditorDialog
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSave}
        task={selectedTask}
        isSaving={mutation.isPending}
      />
    </>
  );
};

export default Tasks;