import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task } from '@/types';
import { formatDateSafe } from '@/utils/date';

interface TaskCardProps {
  task: Task;
}

const priorityVariantMap: Record<Task['priority'], 'default' | 'secondary' | 'destructive'> = {
  'Low': 'secondary',
  'Medium': 'default',
  'High': 'destructive',
};

export function TaskCard({ task }: TaskCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing" onClick={() => navigate(`/tasks/${task.id}`)}>
        <CardHeader className="p-4">
          <CardTitle className="text-base">{task.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant={priorityVariantMap[task.priority]}>{task.priority}</Badge>
            {task.due_date && <span className="text-xs text-muted-foreground">{formatDateSafe(task.due_date)}</span>}
          </div>
          {task.assignee_name && (
            <Tooltip>
              <TooltipTrigger>
                <Avatar className="h-6 w-6">
                  <AvatarFallback>{task.assignee_name.charAt(0)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>Assigned to {task.assignee_name}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardContent>
      </Card>
    </div>
  );
}