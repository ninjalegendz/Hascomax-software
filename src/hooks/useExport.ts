import { showLoading, dismissToast, showError, showSuccess } from '@/utils/toast';

export const useExport = () => {
  const handleExport = async (dataType: string) => {
    const toastId = showLoading(`Exporting ${dataType}...`);
    try {
      const response = await fetch(`/api/export/${dataType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to export ${dataType}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${dataType}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      dismissToast(toastId);
      showSuccess(`${dataType} exported successfully.`);
    } catch (error) {
      dismissToast(toastId);
      showError((error as Error).message);
    }
  };

  return { handleExport };
};