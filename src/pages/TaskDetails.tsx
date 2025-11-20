import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, User, Tag, Type, Megaphone } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import type { Task } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { CommentSection } from '@/components/CommentSection';
import { usePermissions } from '@/hooks/usePermissions';
import { SendUrgentNotificationDialog } from '@/components/SendUrgentNotificationDialog';

const priorityVariantMap: Record<Task['priority'], 'default' | 'secondary' | 'destructive'> = {
  'Low': 'secondary',
  'Medium': 'default',
  'High': 'destructive',
};

const TaskDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const canSendUrgentNotification = usePermissions('tasks:send:urgent-notification');

  const { data: task, isLoading, isError } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => authenticatedFetch(`/api/tasks/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-center py-10">Loading task...</div>;
  }

  if (isError || !task) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Error loading task or task not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/tasks"><ArrowLeft className="mr-2 h-4 w-4" />Back to Tasks</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon"><Link to="/tasks"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
              <p className="text-muted-foreground">Created by {task.creator_name} on {formatDateSafe(task.created_at)}</p>
            </div>
          </div>
          {canSendUrgentNotification && (
            <Button onClick={() => setIsAlertDialogOpen(true)}>
              <Megaphone className="mr-2 h-4 w-4" />
              Send Urgent Alert
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {task.description || 'No description provided.'}
                </p>
              </CardContent>
            </Card>
            <CommentSection taskId={task.id} />
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>Status: {task.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span>Priority: <Badge variant={priorityVariantMap[task.priority]}>{task.priority}</Badge></span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Assignee: {task.assignee_name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Due Date: {formatDateSafe(task.due_date, 'PPP', 'Not set')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <SendUrgentNotificationDialog
        isOpen={isAlertDialogOpen}
        onOpenChange={setIsAlertDialogOpen}
        taskId={task.id}
      />
    </>
  );
};

export default TaskDetails;