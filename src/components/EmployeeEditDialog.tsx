import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';

const employeeEditSchema = z.object({
  role_id: z.string().min(1, 'Role is required.'),
});

interface EmployeeEditDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onEmployeeUpdated: () => void;
  employee: { id: string; first_name: string; last_name: string; role_id: string | null } | null;
}

export function EmployeeEditDialog({ isOpen, onOpenChange, onEmployeeUpdated, employee }: EmployeeEditDialogProps) {
  const [roles, setRoles] = useState<any[]>([]);
  
  const form = useForm<z.infer<typeof employeeEditSchema>>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: { role_id: '' },
  });

  useEffect(() => {
    if (employee) {
      form.setValue('role_id', employee.role_id || '');
    }
  }, [employee, form]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchRoles = async () => {
      try {
        const data = await authenticatedFetch('/api/roles');
        setRoles(data);
      } catch (error) {
        showError("Failed to fetch roles for selection.");
      }
    };
    fetchRoles();
  }, [isOpen]);

  const onSubmit = async (values: z.infer<typeof employeeEditSchema>) => {
    if (!employee) return;
    try {
      await authenticatedFetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      showSuccess('Employee role updated successfully!');
      onEmployeeUpdated();
      onOpenChange(false);
    } catch (error) {
      showError(`Failed to update employee role: ${(error as Error).message}`);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee Role</DialogTitle>
          <DialogDescription>
            Change the role for {employee.first_name} {employee.last_name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField 
              control={form.control} 
              name="role_id" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}