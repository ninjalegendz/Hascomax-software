import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ALL_PERMISSIONS, groupPermissions } from '@/constants/permissions';

const roleSchema = z.object({
  name: z.string().min(2, 'Role name is required.'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required.'),
});

type Role = {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
};

interface RoleEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (role: z.infer<typeof roleSchema>, id?: string) => void;
  role?: Role | null;
}

export function RoleEditorDialog({ isOpen, onOpenChange, onSave, role }: RoleEditorDialogProps) {
  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', description: '', permissions: [] },
  });

  useEffect(() => {
    if (role) {
      form.reset(role);
    } else {
      form.reset({ name: '', description: '', permissions: [] });
    }
  }, [role, form, isOpen]);

  const onSubmit = (values: z.infer<typeof roleSchema>) => {
    onSave(values, role?.id);
  };

  const permissionGroups = groupPermissions(ALL_PERMISSIONS);

  const generateLabel = (permission: string) => {
    return permission
      .split(':')
      .slice(1)
      .join(' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          <DialogDescription>Set the name, description, and permissions for this role.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Role Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>} />
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permissions</FormLabel>
                  <ScrollArea className="h-72 w-full rounded-md border">
                    <div className="p-4 space-y-4">
                      {Object.entries(permissionGroups).map(([group, permissions]) => (
                        <Card key={group}>
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <CardTitle className="text-lg capitalize">{group}</CardTitle>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`select-all-${group}`}
                                checked={permissions.every(p => field.value?.includes(p))}
                                onCheckedChange={(checked) => {
                                  const currentPermissions = field.value || [];
                                  const groupPermissionsSet = new Set(permissions);
                                  let newPermissions;
                                  if (checked) {
                                    newPermissions = [...new Set([...currentPermissions, ...permissions])];
                                  } else {
                                    newPermissions = currentPermissions.filter(p => !groupPermissionsSet.has(p));
                                  }
                                  field.onChange(newPermissions);
                                }}
                              />
                              <label htmlFor={`select-all-${group}`} className="text-sm font-medium leading-none">
                                Select All
                              </label>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="grid grid-cols-2 gap-4">
                              {permissions.map((permission) => (
                                <FormField
                                  key={permission}
                                  control={form.control}
                                  name="permissions"
                                  render={({ field: innerField }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={innerField.value?.includes(permission)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? innerField.onChange([...innerField.value, permission])
                                              : innerField.onChange(innerField.value?.filter((value) => value !== permission));
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {generateLabel(permission)}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit">Save Role</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}