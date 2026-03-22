// URL de base — même origine (IP ou domaine courant)
const BASE_URL = '/api';

// Helper interne — toutes les requêtes passent par là
async function request(method, path, body = null) {
  const options = {
    method,
    credentials: 'include', // envoie le cookie de session automatiquement
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(BASE_URL + path, options);

  // 204 No Content — pas de corps JSON à parser
  if (res.status === 204) return null;

  const data = await res.json();

  // Si le serveur retourne une erreur, on la lance comme exception
  // pour que le catch dans app.js puisse la capturer
  if (!res.ok) {
    const err = new Error(data.error || 'Erreur serveur');
    err.status = res.status;
    err.errors = data.errors || null; // erreurs de validation champ par champ
    throw err;
  }

  return data;
}

// ── Auth ────────────────────────────────────────────────────────────
const api = {
  auth: {
    login:    (email, password) => request('POST', '/auth/login',    { email, password }),
    register: (name, email, password) => request('POST', '/auth/register', { name, email, password }),
    logout:   ()                => request('POST', '/auth/logout'),
    me:       ()                => request('GET',  '/auth/me'),
  },

  // ── Workspaces ────────────────────────────────────────────────────
  workspaces: {
    list:   ()           => request('GET',    '/workspaces'),
    create: (name)       => request('POST',   '/workspaces',    { name }),
    delete: (id)         => request('DELETE', `/workspaces/${id}`),
    update: (id, name)   => request('PUT',    `/workspaces/${id}`, { name }),
  },

  // ── Pages ─────────────────────────────────────────────────────────
  pages: {
    list:   (wsId)              => request('GET',    `/workspaces/${wsId}/pages`),
    create: (wsId, title, content) => request('POST', `/workspaces/${wsId}/pages`, { title, content }),
    get:    (wsId, id)          => request('GET',    `/workspaces/${wsId}/pages/${id}`),
    update: (wsId, id, title, content) => request('PUT', `/workspaces/${wsId}/pages/${id}`, { title, content }),
    delete: (wsId, id)          => request('DELETE', `/workspaces/${wsId}/pages/${id}`),
  },
};
