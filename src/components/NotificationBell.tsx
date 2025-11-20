import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { formatDistanceToNowSafe } from '@/utils/date';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  message: string;
  link: string;
  is_read: number;
  created_at: string;
  actor_name: string;
}

export function NotificationBell() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const socket = useRealtime();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => authenticatedFetch('/api/notifications'),
    enabled: !!profile,
  });

  useEffect(() => {
    if (!socket || !profile) return;

    const handleNewNotification = (data: { recipientId: string }) => {
      if (data.recipientId === profile.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, profile, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: () => authenticatedFetch('/api/notifications/mark-read', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && unreadCount > 0) {
      markReadMutation.mutate();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    navigate(notification.link);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notifications</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications && notifications.length > 0 ? (
          notifications.map(n => (
            <DropdownMenuItem key={n.id} onClick={() => handleNotificationClick(n)} className={cn("flex items-start gap-3 p-2 cursor-pointer", !n.is_read && "bg-muted/50")}>
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback>{n.actor_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm whitespace-normal">{n.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNowSafe(n.created_at, { addSuffix: true })}</p>
              </div>
              {!n.is_read && <Circle className="h-2 w-2 fill-primary text-primary mt-1" />}
            </DropdownMenuItem>
          ))
        ) : (
          <p className="p-4 text-sm text-center text-muted-foreground">No new notifications</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}