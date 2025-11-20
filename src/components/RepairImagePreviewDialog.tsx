import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RepairImagePreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageUrl: string;
  onChangeImage: () => void;
}

export function RepairImagePreviewDialog({
  isOpen,
  onOpenChange,
  imageUrl,
  onChangeImage,
}: RepairImagePreviewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Image Preview</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <img src={imageUrl} alt="Repair preview" className="w-full h-auto max-h-[70vh] object-contain rounded-md" />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => {
            onChangeImage();
            onOpenChange(false);
          }}>
            Change Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}