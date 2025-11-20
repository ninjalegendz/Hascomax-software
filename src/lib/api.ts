export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    const text = await response.text();
    try {
      errorData = JSON.parse(text);
    } catch (e) {
      // Use text content if JSON parse fails (e.g., HTML 404 page)
      console.error("API Error (Non-JSON response):", text);
      errorData = { error: `Request failed (${response.status}). Check console for details.` };
    }
    throw new Error(errorData.error || 'An API error occurred');
  }

  // Handle responses with no content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return; 
  }
};