import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';

const employeeSchema = z.object({
  first_name: z.string().min(1, 'First name is required.'),
  last_name: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  role_id: z.string().min(1, 'Role is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface EmployeeEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onEmployeeAdded: () => void;
}

export function EmployeeEditorDialog({ isOpen, onOpenChange, onEmployeeAdded }: EmployeeEditorDialogProps) {
  const [roles, setRoles] = useState<any[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { first_name: '', last_name: '', email: '', role_id: '', password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!isOpen) return;
    const fetchRoles = async () => {
      try {
        const data = await authenticatedFetch('/api/roles');
        setRoles(data || []);
      } catch (error) {
        showError("Failed to fetch roles for selection.");
      }
    };
    fetchRoles();
  }, [isOpen]);

  const onSubmit = async (values: z.infer<typeof employeeSchema>) => {
    setSubmissionError(null);
    const { confirmPassword, ...payload } = values;
    
    try {
      await authenticatedFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showSuccess('Employee account created successfully!');
      onEmployeeAdded();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      setSubmissionError((error as Error).message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Set their details and a temporary password. The employee will be prompted to change it on their first login.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {submissionError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Creating Employee</AlertTitle>
                <AlertDescription>{submissionError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="first_name" render={({ field }) => <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="last_name" render={({ field }) => <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="role_id" render={({ field }) => <FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl><SelectContent>{roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating Account...' : 'Add Employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}