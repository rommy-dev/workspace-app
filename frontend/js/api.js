// URL de base — même origine (IP ou domaine courant)
const BASE_URL = '/api';

// Helper interne — toutes les requêtes passent par là
async function request(method, path, body = null) {
  ui.showLoader();

  try {
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
  } finally {
    ui.hideLoader();
  }
}

// ── Auth ────────────────────────────────────────────────────────────
const api = {
  auth: {
    login:    (email, password) => request('POST', '/auth/login',    { email, password }),
    register: (name, email, password) => request('POST', '/auth/register', { name, email, password }),
    logout:   ()                => request('POST', '/auth/logout'),
    me:       ()                => request('GET',  '/auth/me'),
  },

  // ── Profil utilisateur ─────────────────────────────────────────────
  profile: {
    get:            (id)                              => request('GET',  `/users/${id}`),
    me:             ()                                => request('GET',  '/profile'),
    update:         (name, email, avatarUrl)          => request('PUT',  '/profile', { name, email, avatar_url: avatarUrl }),
    uploadAvatar:   (file)                            => {
      ui.showLoader();
      const formData = new FormData();
      formData.append('avatar', file);
      return fetch(BASE_URL + '/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(res => {
        if (res.status === 204) return null;
        return res.json().then(data => {
          if (!res.ok) {
            const err = new Error(data.error || 'Erreur serveur');
            err.status = res.status;
            err.errors = data.errors || null;
            throw err;
          }
          return data;
        });
      }).finally(() => {
        ui.hideLoader();
      });
    },
    updatePassword: (currentPassword, newPassword)   => request('PUT',  '/profile/password', { current_password: currentPassword, new_password: newPassword }),
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

  // ── Commentaires ─────────────────────────────────────────────────
  comments: {
    list:   (wsId, pageId)           => request('GET',    `/workspaces/${wsId}/pages/${pageId}/comments`),
    create: (wsId, pageId, content)  => request('POST',   `/workspaces/${wsId}/pages/${pageId}/comments`, { content }),
    update: (wsId, pageId, id, content) => request('PUT', `/workspaces/${wsId}/pages/${pageId}/comments/${id}`, { content }),
    delete: (wsId, pageId, id)       => request('DELETE', `/workspaces/${wsId}/pages/${pageId}/comments/${id}`),
  },

  // ── Membres ──────────────────────────────────────────────────────
  members: {
    list:   (wsId)             => request('GET',    `/workspaces/${wsId}/members`),
    add:    (wsId, email, role) => request('POST',   `/workspaces/${wsId}/members`, { email, role }),
    remove: (wsId, userId)     => request('DELETE', `/workspaces/${wsId}/members/${userId}`),
  },

  // ── Partage de pages ─────────────────────────────────────────────
  shares: {
    list:   (wsId, pageId)                  => request('GET',    `/workspaces/${wsId}/pages/${pageId}/shares`),
    create: (wsId, pageId, email, permission) => request('POST',   `/workspaces/${wsId}/pages/${pageId}/shares`, { email, permission }),
    update: (wsId, pageId, userId, permission) => request('PUT',    `/workspaces/${wsId}/pages/${pageId}/shares/${userId}`, { permission }),
    remove: (wsId, pageId, userId)          => request('DELETE', `/workspaces/${wsId}/pages/${pageId}/shares/${userId}`),
    listShared: ()                          => request('GET',    '/pages/shared'),
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  dashboard: {
    get: (period = '') => {
      const qs = period ? `?period=${encodeURIComponent(period)}` : '';
      return request('GET', `/dashboard${qs}`);
    },
  },
};
