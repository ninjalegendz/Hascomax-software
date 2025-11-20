import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewConversationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function NewConversationDialog({ isOpen, onOpenChange }: NewConversationDialogProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: employees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => authenticatedFetch('/api/employees'),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (recipientId: string) =>
      authenticatedFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId, content: "👋" }), // Start with a wave
      }),
    onSuccess: (data) => {
      onOpenChange(false);
      setSelectedUserId(null);
      navigate(`/messages/${data.conversation_id}`);
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleStartConversation = () => {
    if (selectedUserId) {
      mutation.mutate(selectedUserId);
    }
  };

  const otherEmployees = employees?.filter(emp => emp.id !== profile?.id) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Select a team member to start a conversation with.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search for a team member..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {otherEmployees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.first_name} ${emp.last_name}`}
                  onSelect={() => setSelectedUserId(emp.id)}
                  className="flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{emp.first_name} {emp.last_name}</span>
                  </div>
                  <Check className={cn("h-4 w-4", selectedUserId === emp.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <Button onClick={handleStartConversation} disabled={!selectedUserId || mutation.isPending}>
            Start Conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}