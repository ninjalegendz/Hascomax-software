import React from 'react';
import { DndContext, pointerWithin, type DragEndEvent } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showError } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import type { Task } from '@/types';
import { TaskColumn } from './TaskColumn';

const STATUSES: Task['status'][] = ['To Do', 'In Progress', 'Done', 'Cancelled'];

interface TaskBoardProps {
  tasks: Task[];
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const queryClient = useQueryClient();

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<Task['status'], Task[]>);

  const mutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string, status: Task['status'] }) => 
      authenticatedFetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let newStatus: Task['status'] | undefined;
    if (STATUSES.includes(over.id as any)) {
      newStatus = over.id as Task['status'];
    } else {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) {
        newStatus = overTask.status;
      }
    }

    if (newStatus && task.status !== newStatus) {
      mutation.mutate({ taskId, status: newStatus });
    }
  };

  return (
    <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <TaskColumn key={status} status={status} tasks={tasksByStatus[status]} />
        ))}
      </div>
    </DndContext>
  );
}