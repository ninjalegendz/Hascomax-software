import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, Camera } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { RepairImagePreviewDialog } from './RepairImagePreviewDialog';

type Side = 'front' | 'back' | 'left' | 'right' | 'top';
const SIDES: Side[] = ['front', 'back', 'left', 'right', 'top'];

interface ImageSlotProps {
  repairId: string;
  stage: 'before' | 'after';
  side: Side;
  imageUrl?: string;
  onUploadSuccess: () => void;
}

const ImageSlot: React.FC<ImageSlotProps> = ({ repairId, stage, side, imageUrl, onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setIsUploading(true);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('stage', stage);
    formData.append('side', side);

    try {
      await authenticatedFetch(`/api/repairs/${repairId}/images`, {
        method: 'POST',
        body: formData,
      });
      onUploadSuccess();
    } catch (error) {
      showError((error as Error).message);
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (imageUrl || preview) {
      setIsPreviewOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleChangeImage = () => {
    fileInputRef.current?.click();
  };

  const currentImageUrl = preview || imageUrl;

  return (
    <>
      <Card
        className="aspect-square flex items-center justify-center relative group overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={`${side} view`} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-muted-foreground">
            <Camera className="mx-auto h-8 w-8 mb-2" />
            <p className="text-sm font-medium capitalize">{side}</p>
          </div>
        )}
        <div className={cn(
          "absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity",
          isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : (
            <UploadCloud className="h-8 w-8 text-white" />
          )}
        </div>
      </Card>
      {currentImageUrl && (
        <RepairImagePreviewDialog
          isOpen={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          imageUrl={currentImageUrl}
          onChangeImage={handleChangeImage}
        />
      )}
    </>
  );
};

interface RepairImageUploaderProps {
  repairId: string;
  stage: 'before' | 'after';
  images: { side: Side; image_url: string }[];
  onUploadSuccess: () => void;
}

export const RepairImageUploader: React.FC<RepairImageUploaderProps> = ({ repairId, stage, images, onUploadSuccess }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {SIDES.map(side => {
        const existingImage = images.find(img => img.side === side);
        return (
          <ImageSlot
            key={side}
            repairId={repairId}
            stage={stage}
            side={side}
            imageUrl={existingImage?.image_url}
            onUploadSuccess={onUploadSuccess}
          />
        );
      })}
    </div>
  );
};