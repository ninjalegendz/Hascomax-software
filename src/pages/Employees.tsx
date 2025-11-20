import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { EmployeeEditorDialog } from '@/components/EmployeeEditorDialog';
import { EmployeeEditDialog } from '@/components/EmployeeEditDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { authenticatedFetch } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';

const Employees = () => {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAddEditorOpen, setIsAddEditorOpen] = useState(false);
  const [isEditEditorOpen, setIsEditEditorOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const canCreate = usePermissions('employees:create');
  const canEdit = usePermissions('employees:edit');
  const canDelete = usePermissions('employees:delete');

  const fetchEmployees = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await authenticatedFetch('/api/employees');
      setEmployees(data || []);
    } catch (error) {
      showError("Failed to fetch employees.");
      console.error(error);
    }
  }, [profile]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      await authenticatedFetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
      showSuccess('Employee deleted successfully.');
      fetchEmployees();
    } catch (error) {
      showError(`Failed to delete employee: ${(error as Error).message}`);
    }
  };

  const handleEditClick = (employee: any) => {
    setSelectedEmployee(employee);
    setIsEditEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Add and manage your team members.</CardDescription>
          </div>
          {canCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => setIsAddEditorOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Employee</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new employee account.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length > 0 ? (
                  employees.map(employee => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
                        {employee.id === profile?.id && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.role_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>More actions</p>
                              </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent>
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleEditClick(employee)}>
                                  Edit Role
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      disabled={employee.id === profile?.id}
                                      className={employee.id === profile?.id ? "text-muted-foreground" : "text-destructive focus:bg-destructive/10 focus:text-destructive"}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the employee's account. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90"
                                        onClick={() => handleDeleteEmployee(employee.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">No employees found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <EmployeeEditorDialog isOpen={isAddEditorOpen} onOpenChange={setIsAddEditorOpen} onEmployeeAdded={fetchEmployees} />
      <EmployeeEditDialog 
        isOpen={isEditEditorOpen} 
        onOpenChange={setIsEditEditorOpen} 
        onEmployeeUpdated={fetchEmployees}
        employee={selectedEmployee}
      />
    </>
  );
};

export default Employees;