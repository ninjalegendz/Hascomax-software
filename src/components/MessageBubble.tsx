import React, { useState } from 'react';
import { useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import type { Message } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, CheckCheck, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { showError } from '@/utils/toast';

interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

export function MessageBubble({ message, isSender, isFirstInGroup, isLastInGroup }: MessageBubbleProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const editMutation = useMutation({
    mutationFn: (content: string) =>
      authenticatedFetch(`/api/messages/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    onMutate: async (newContent: string) => {
      setIsEditing(false);
      await queryClient.cancelQueries({ queryKey: ['messages', message.conversation_id] });
      const previousMessages = queryClient.getQueryData(['messages', message.conversation_id]);
      queryClient.setQueryData(['messages', message.conversation_id], (oldData: InfiniteData<MessagesPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            messages: page.messages.map(m => m.id === message.id ? { ...m, content: newContent } : m),
          })),
        };
      });
      return { previousMessages };
    },
    onError: (err, vars, context) => {
      showError("Failed to edit message.");
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', message.conversation_id], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', message.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => authenticatedFetch(`/api/messages/${message.id}`, { method: 'DELETE' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['messages', message.conversation_id] });
      const previousMessages = queryClient.getQueryData(['messages', message.conversation_id]);
      queryClient.setQueryData(['messages', message.conversation_id], (oldData: InfiniteData<MessagesPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            messages: page.messages.filter(m => m.id !== message.id),
          })),
        };
      });
      return { previousMessages };
    },
    onError: (err, vars, context) => {
      showError("Failed to delete message.");
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', message.conversation_id], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', message.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent.trim() !== message.content) {
      editMutation.mutate(editedContent.trim());
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className={cn('flex items-end gap-2 group', isSender ? 'justify-end' : 'justify-start', !isFirstInGroup && (isSender ? 'mt-0.5' : 'mt-0.5'))}>
      {!isSender && (
        <Avatar className={cn('h-8 w-8', !isLastInGroup && 'invisible')}>
          <AvatarFallback>{message.sender_name.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      {isSender && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setIsEditing(true); setEditedContent(message.content); }}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Message?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className={cn('max-w-xs lg:max-w-md p-3', 
        isSender ? 'bg-primary text-primary-foreground' : 'bg-muted',
        isFirstInGroup && !isLastInGroup && (isSender ? 'rounded-t-lg rounded-bl-lg' : 'rounded-t-lg rounded-br-lg'),
        !isFirstInGroup && !isLastInGroup && (isSender ? 'rounded-l-lg' : 'rounded-r-lg'),
        !isFirstInGroup && isLastInGroup && (isSender ? 'rounded-b-lg rounded-tl-lg' : 'rounded-b-lg rounded-tr-lg'),
        isFirstInGroup && isLastInGroup && 'rounded-lg'
      )}>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="bg-background/20 text-primary-foreground min-w-64" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={editMutation.isPending}>Save</Button>
            </div>
          </div>
        ) : (
          <>
            {isFirstInGroup && !isSender && <p className="font-semibold text-sm mb-1">{message.sender_name}</p>}
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <div className="flex items-center justify-end gap-1 text-xs opacity-70 mt-1">
              <span>{format(new Date(message.created_at), 'p')}</span>
              {isSender && (message.is_read ? <CheckCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}