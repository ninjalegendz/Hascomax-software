import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface ChatHeaderProps {
  participantName: string;
}

export function ChatHeader({ participantName }: ChatHeaderProps) {
  return (
    <div className="p-4 border-b flex items-center gap-4">
      <Button asChild variant="ghost" size="icon" className="md:hidden">
        <Link to="/messages"><ArrowLeft className="h-5 w-5" /></Link>
      </Button>
      <h2 className="text-xl font-bold">{participantName}</h2>
    </div>
  );
}