import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrgentNotification } from '@/contexts/UrgentNotificationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneOff, Megaphone } from 'lucide-react';

export function UrgentNotificationToast() {
  const { notification, dismiss } = useUrgentNotification();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (notification && audioRef.current) {
      audioRef.current.play().catch(error => console.error("Audio play failed:", error));
    } else if (!notification && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [notification]);

  if (!notification) {
    return null;
  }

  const handleAccept = () => {
    navigate(`/tasks/${notification.taskId}`);
    dismiss();
  };

  const handleDecline = () => {
    dismiss();
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      <audio ref={audioRef} src="/ringtone.mp3" loop />
      <Card className="w-80 animate-pulse border-primary shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground rounded-full p-2">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Urgent Notification</CardTitle>
              <CardDescription>{notification.senderName} needs your attention.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">
            Task: <span className="font-semibold">{notification.taskTitle}</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={handleDecline}>
              <PhoneOff className="mr-2 h-4 w-4" />
              Decline
            </Button>
            <Button onClick={handleAccept}>
              <Phone className="mr-2 h-4 w-4" />
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}