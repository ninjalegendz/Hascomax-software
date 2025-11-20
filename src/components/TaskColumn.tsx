import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '@/types';
import { TaskCard } from './TaskCard';

interface TaskColumnProps {
  status: Task['status'];
  tasks: Task[];
}

export function TaskColumn({ status, tasks }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div 
      ref={setNodeRef}
      className={`bg-muted/50 rounded-lg p-4 flex flex-col gap-4 min-h-[400px] transition-colors ${isOver ? 'bg-primary/10' : ''}`}
    >
      <h3 className="font-semibold">{status} <span className="text-sm text-muted-foreground">({tasks.length})</span></h3>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Drop tasks here
            </div>
          ) : (
            tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}