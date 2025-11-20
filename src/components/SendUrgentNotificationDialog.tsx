import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface SendUrgentNotificationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  taskId: string;
}

export function SendUrgentNotificationDialog({ isOpen, onOpenChange, taskId }: SendUrgentNotificationDialogProps) {
  const { profile } = useAuth();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: employees, isLoading } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => authenticatedFetch('/api/employees'),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (recipientIds: string[]) =>
      authenticatedFetch(`/api/tasks/${taskId}/urgent-notification`, {
        method: 'POST',
        body: JSON.stringify({ recipientIds }),
      }),
    onSuccess: () => {
      showSuccess('Urgent notification sent!');
      onOpenChange(false);
      setSelectedUserIds([]);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleSend = () => {
    if (selectedUserIds.length > 0) {
      mutation.mutate(selectedUserIds);
    }
  };

  const otherEmployees = employees?.filter(emp => emp.id !== profile?.id) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Urgent Notification</DialogTitle>
          <DialogDescription>Select which team members to notify immediately about this task.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-4 space-y-4">
                {otherEmployees.map(emp => (
                  <div key={emp.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`user-${emp.id}`}
                      checked={selectedUserIds.includes(emp.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUserIds(prev =>
                          checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id)
                        );
                      }}
                    />
                    <label htmlFor={`user-${emp.id}`} className="flex items-center gap-3 cursor-pointer">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                        <p className="text-sm text-muted-foreground">{emp.role_name || 'No Role'}</p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
          <Button onClick={handleSend} disabled={selectedUserIds.length === 0 || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Notification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}