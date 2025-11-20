import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, RefreshCw, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { RoleEditorDialog } from '@/components/RoleEditorDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { authenticatedFetch } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

const Roles = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const { refreshProfile } = useAuth();

  const canCreate = usePermissions('roles:create');
  const canEdit = usePermissions('roles:edit');
  const canDelete = usePermissions('roles:delete');

  const fetchRoles = async () => {
    try {
      const data = await authenticatedFetch('/api/roles');
      setRoles(data);
    } catch (error) {
      showError("Failed to fetch roles.");
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const resetMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/roles/${id}/reset`, { method: 'PUT' }),
    onSuccess: async () => {
        showSuccess('Admin role permissions have been reset.');
        await fetchRoles();
        await refreshProfile();
    },
    onError: (error) => {
        showError((error as Error).message);
    },
  });

  const handleSaveRole = async (roleData: any, id?: string) => {
    try {
      const url = id ? `/api/roles/${id}` : '/api/roles';
      const method = id ? 'PUT' : 'POST';
      await authenticatedFetch(url, {
        method,
        body: JSON.stringify(roleData),
      });
      showSuccess(id ? 'Role updated successfully.' : 'Role created successfully.');
      await fetchRoles();
      await refreshProfile();
      setIsEditorOpen(false);
    } catch (error) {
      showError((error as Error).message);
    }
  };

  const handleDeleteRole = async (id: string) => {
    try {
      await authenticatedFetch(`/api/roles/${id}`, { method: 'DELETE' });
      showSuccess('Role deleted successfully.');
      fetchRoles();
    } catch (error) {
      showError('Failed to delete role.');
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>Define roles to control what users can do in the app.</CardDescription>
          </div>
          {canCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => { setSelectedRole(null); setIsEditorOpen(true); }}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Role</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Define a new user role and set its permissions.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>{role.permissions.length} granted</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {role.name === 'Admin' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => resetMutation.mutate(role.id)} disabled={resetMutation.isPending}>
                                {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reset to Default Permissions</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>More actions</p>
                              </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent>
                              {canEdit && <DropdownMenuItem onClick={() => { setSelectedRole(role); setIsEditorOpen(true); }}>Edit</DropdownMenuItem>}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuItem></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteRole(role.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <RoleEditorDialog isOpen={isEditorOpen} onOpenChange={setIsEditorOpen} onSave={handleSaveRole} role={selectedRole} />
    </>
  );
};

export default Roles;