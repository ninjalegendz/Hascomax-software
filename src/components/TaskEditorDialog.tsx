import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/datepicker';
import type { Task } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';

const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  description: z.string().optional(),
  assignee_id: z.string().optional(),
  due_date: z.date().optional(),
  priority: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['To Do', 'In Progress', 'Done', 'Cancelled']),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: TaskFormValues, id?: string) => void;
  task?: Task | null;
  isSaving: boolean;
}

export function TaskEditorDialog({ isOpen, onOpenChange, onSave, task, isSaving }: TaskEditorDialogProps) {
  const canAssign = usePermissions('tasks:assign');
  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => authenticatedFetch('/api/employees'),
    enabled: isOpen && canAssign,
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', priority: 'Medium', status: 'To Do' },
  });

  useEffect(() => {
    if (isOpen) {
      if (task) {
        form.reset({
          ...task,
          due_date: task.due_date ? new Date(task.due_date) : undefined,
        });
      } else {
        form.reset({ title: '', description: '', priority: 'Medium', status: 'To Do', assignee_id: '', due_date: undefined });
      }
    }
  }, [task, form, isOpen]);

  const handleSubmit = (values: TaskFormValues) => {
    onSave(values, task?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>Fill in the details for the task below.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="grid grid-cols-2 gap-4">
              {canAssign && (
                <FormField control={form.control} name="assignee_id" render={({ field }) => <FormItem><FormLabel>Assignee (optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl><SelectContent>{employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              )}
              <FormField control={form.control} name="due_date" render={({ field }) => <FormItem><FormLabel>Due Date (optional)</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="priority" render={({ field }) => <FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="status" render={({ field }) => <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="To Do">To Do</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Done">Done</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : (task ? 'Save Changes' : 'Create Task')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}