const API = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
export function getToken(){ return localStorage.getItem('findback_token'); }
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try { response = await fetch(`${API}${path}`, { ...options, headers }); }
  catch { throw new Error('Cannot connect to FindBack API. Make sure the backend is running.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed. Please try again.');
  return data;
}
