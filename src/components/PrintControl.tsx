import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { showLoading, dismissToast, showSuccess, showError } from '@/utils/toast';

interface PrintControlProps {
  documentRef: React.RefObject<HTMLDivElement>;
  fileName: string;
}

// Helper to prepare content: clone and replace links
const preparePrintContent = (element: HTMLElement): HTMLElement => {
  const contentToPrint = element.cloneNode(true) as HTMLElement;
  // Find all links inside the cloned content that are internal app links
  const links = contentToPrint.querySelectorAll('a[href^="/"]');
  links.forEach(link => {
    const span = document.createElement('span');
    span.textContent = link.textContent;
    // Copy classes to maintain styling like font-bold, but remove link-specific styling
    span.className = link.className.replace('hover:underline', '');
    link.parentNode?.replaceChild(span, link);
  });
  return contentToPrint;
};

// Helper to convert image to base64
const imageToBase64 = (img: HTMLImageElement): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    const tempImg = new Image();
    
    // Check if the image is external
    if (img.src.startsWith('http')) {
      // Use proxy for external images
      tempImg.src = `/api/image-proxy?url=${encodeURIComponent(img.src)}`;
    } else {
      // Use original src for local/internal images
      tempImg.src = img.src;
    }

    tempImg.onload = () => {
      ctx.drawImage(tempImg, 0, 0);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (e) {
        console.warn('Could not convert image to base64:', e);
        resolve(img.src);
      }
    };
    tempImg.onerror = () => {
      console.warn('Could not load image for conversion:', img.src);
      resolve(img.src);
    };
  });
};

// Helper to wait for all images in a document to load and convert them to base64
const processImages = async (doc: Document): Promise<void> => {
  const images = Array.from(doc.images);
  const promises = images.map(async (img) => {
    if (!img.complete || img.naturalHeight === 0) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          console.warn(`Could not load image: ${img.src}`);
          resolve(null);
        };
      });
    }
    
    // Convert to base64 to avoid CORS issues
    try {
      const base64 = await imageToBase64(img);
      img.src = base64;
    } catch (e) {
      console.warn('Could not convert image:', e);
    }
  });
  await Promise.all(promises);
};

export function PrintControl({ documentRef, fileName }: PrintControlProps) {
  const handleDownloadPdf = async () => {
    const toastId = showLoading("Generating PDF...");
    const element = documentRef.current;
    if (!element) {
      dismissToast(toastId);
      showError("Could not find document content to download.");
      return;
    }

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '210mm'; // A4 width
    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentWindow!.document;
    
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        if (styleSheet.href) {
          const link = printDocument.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          printDocument.head.appendChild(link);
        } else if (styleSheet.cssRules) {
          const style = printDocument.createElement('style');
          style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
          printDocument.head.appendChild(style);
        }
      } catch (e) {
        console.warn('Could not copy stylesheet:', e);
      }
    });

    const printStyles = `
      @page { size: A4; margin: 0; }
      body { 
        background-color: white !important; 
        margin: 0; 
        width: 210mm;
        box-sizing: border-box;
      }
    `;
    const styleEl = printDocument.createElement('style');
    styleEl.textContent = printStyles;
    printDocument.head.appendChild(styleEl);

    const contentToPrint = preparePrintContent(element);
    printDocument.body.appendChild(contentToPrint);

    try {
      await processImages(printDocument);
      await new Promise(resolve => setTimeout(resolve, 500)); // Extra buffer for rendering

      const canvas = await html2canvas(printDocument.body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const data = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProperties = pdf.getImageProperties(data);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProperties.height * pdfWidth) / imgProperties.width;

      pdf.addImage(data, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${fileName}.pdf`);
      
      dismissToast(toastId);
      showSuccess("PDF downloaded successfully!");
    } catch (error) {
      dismissToast(toastId);
      showError("Failed to generate PDF.");
      console.error("PDF Generation Error:", error);
    } finally {
      document.body.removeChild(printFrame);
    }
  };

  const handlePrint = (paperSize: 'A4' | 'A5' | 'Receipt') => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentWindow!.document;
    if (!documentRef.current) return;
    
    const contentToPrint = preparePrintContent(documentRef.current);
    
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        if (styleSheet.href) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          printDocument.head.appendChild(link);
        } else {
          const style = document.createElement('style');
          style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
          printDocument.head.appendChild(style);
        }
      } catch (e) {
        console.warn('Could not copy stylesheet:', e);
      }
    });

    let printStyles = `body { background-color: white !important; }`;
    if (paperSize === 'A4') {
      printStyles += `@page { size: A4; margin: 0; } body { margin: 0; }`;
    } else if (paperSize === 'A5') {
      printStyles += `@page { size: A5; margin: 0; } body { margin: 0; }`;
    } else if (paperSize === 'Receipt') {
      printStyles += `
        @page { size: 80mm; margin: 0; }
        body { margin: 2mm; font-size: 10px; max-width: 76mm; }
        h1 { font-size: 16px; } h2 { font-size: 14px; } table { font-size: 10px; }
        .text-3xl { font-size: 24px; } .text-2xl { font-size: 20px; } .text-lg { font-size: 14px; }
        .text-sm { font-size: 10px; } .text-xs { font-size: 8px; }
      `;
    }

    const styleEl = printDocument.createElement('style');
    styleEl.textContent = printStyles;
    printDocument.head.appendChild(styleEl);
    
    printDocument.body.appendChild(contentToPrint);

    printFrame.contentWindow!.onload = () => {
      printFrame.contentWindow!.focus();
      printFrame.contentWindow!.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    };
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print / Download</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handlePrint('A4')}>Print (A4)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('A5')}>Print (A5)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('Receipt')}>Print (Receipt)</DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4" />Download PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}