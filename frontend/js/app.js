// ── Initialisation ──────────────────────────────────────────────────
// Vérifie si une session existe déjà (rechargement de page)
async function init() {
  try {
    const data = await api.auth.me();
    state.currentUser = data.user;
    ui.showAppScreen(data.user);
    await loadWorkspaces();
    // Affiche le dashboard par défaut au démarrage
    await loadDashboard();
  } catch {
    // Pas de session active — on affiche l'écran de connexion
    ui.showAuthScreen();
  }
}

// ── Fermeture de page ──────────────────────────────────────────────────────
function closeCurrentPage() {
  // Ferme l'onglet/la fenêtre si possible
  if (window.opener) {
    // Si la fenêtre a été ouverte par une autre, on peut la fermer
    window.close();
  } else {
    // Sinon, on redirige vers une page blanche ou on ferme si c'est le seul onglet
    try {
      window.close();
    } catch (e) {
      // Si on ne peut pas fermer, on redirige vers about:blank
      window.location.href = 'about:blank';
    }
  }
}

// ── Auth ────────────────────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', async () => {
  ui.clearError('login-error');
  const email    = ui.val('login-email');
  const password = ui.val('login-password');

  try {
    const data = await api.auth.login(email, password);
    state.currentUser = data.user;
    ui.clearVal('login-email');
    ui.clearVal('login-password');
    ui.clearError('login-error');
    ui.showAppScreen(data.user);
    await loadWorkspaces();
    // Affiche le dashboard par défaut après connexion
    await loadDashboard();
  } catch (err) {
    ui.showError('login-error', err.message);
  }
});

// Event listener pour la touche Entrée sur le champ de mot de passe de connexion
document.getElementById('login-password').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('login-btn').click();
  }
});

document.getElementById('register-btn').addEventListener('click', async () => {
  ui.clearError('register-error');
  const name     = ui.val('register-name');
  const email    = ui.val('register-email');
  const password = ui.val('register-password');

  try {
    const data = await api.auth.register(name, email, password);
    state.currentUser = data.user;
    ui.clearVal('register-name');
    ui.clearVal('register-email');
    ui.clearVal('register-password');
    ui.clearError('register-error');
    ui.showAppScreen(data.user);
    await loadWorkspaces();
    // Affiche le dashboard par défaut après inscription
    await loadDashboard();
  } catch (err) {
    // Affiche les erreurs de validation champ par champ si disponibles
    const msg = err.errors
      ? Object.values(err.errors).join(' ')
      : err.message;
    ui.showError('register-error', msg);
  }
});

// Event listener pour la touche Entrée sur le champ de mot de passe d'inscription
document.getElementById('register-password').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('register-btn').click();
  }
}); 

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api.auth.logout();
  
  // Réinitialise l'état complet
  state.currentUser        = null;
  state.workspaces         = [];
  state.currentWorkspaceId = null;
  state.currentWorkspaceRole = null;
  state.members            = [];
  state.pages              = [];
  state.currentPageId      = null;
  
  // Ferme la page active et retourne à l'état initial
  ui.showEmptyState();
  
  // Affiche l'écran d'authentification
  ui.showAuthScreen();
  
  // Ferme la page active après déconnexion
  setTimeout(() => {
    closeCurrentPage();
  }, 500); // Délai pour permettre la déconnexion complète
});

// ── Toggle mot de passe (icône œil) ─────────────────────────────────
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';

      const iconEl = btn.querySelector('[data-lucide]');
      if (iconEl) iconEl.setAttribute('data-lucide', show ? 'eye-off' : 'eye');

      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      ui.refreshIcons();
    });
  });
}

// ── Icônes Lucide ───────────────────────────────────────────────────
function initLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
    return;
  }

  const script = document.getElementById('lucide-script');
  if (!script) return;

  script.addEventListener('load', () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, { once: true });
}

// ── Sidebar toggle ──────────────────────────────────────────────────
function initSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');

    const iconEl = toggle.querySelector('[data-lucide]');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-left');
    }

    toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    toggle.setAttribute('aria-label', collapsed ? 'Ouvrir le menu' : 'Fermer le menu');
    ui.refreshIcons();
  });
}

// ── Tabs auth ───────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    document.getElementById(tab.dataset.tab + '-form').classList.remove('hidden');
  });
});

// ── Workspaces ──────────────────────────────────────────────────────
function roleCanEditPages(role) {
  return ['owner', 'admin', 'editor'].includes(role);
}

function roleCanManageMembers(role) {
  return ['owner', 'admin'].includes(role);
}

function resolveCurrentRole(workspace, members) {
  if (workspace && workspace.role) return workspace.role;
  const me = members.find(m => parseInt(m.user_id) === state.currentUser.id);
  return me ? me.role : 'viewer';
}

async function loadWorkspaces() {
  const data = await api.workspaces.list();
  state.workspaces = data.workspaces;
  ui.renderWorkspaceList(state.workspaces, state.currentWorkspaceId);
}

async function loadMembers(workspaceId, workspace) {
  const data = await api.members.list(workspaceId);
  state.members = data.members;

  ui.clearError('invite-error');

  const role = resolveCurrentRole(workspace, state.members);
  state.currentWorkspaceRole = role;

  ui.setWorkspaceRole(role);
  ui.toggleInviteForm(roleCanManageMembers(role));
  ui.renderMemberList(state.members, state.currentUser.id, roleCanManageMembers(role));
  ui.setWorkspaceActions({
    canDeleteWorkspace: role === 'owner',
    canEditPages: roleCanEditPages(role),
  });
}

async function selectWorkspace(id) {
  state.currentWorkspaceId = id;
  state.currentPageId      = null;

  const data = await api.pages.list(id);
  state.pages = data.pages;

  const workspace = state.workspaces.find(w => w.id === id);
  const dashboardBtn = document.getElementById('dashboard-btn');
  if (dashboardBtn) dashboardBtn.classList.remove('active');
  ui.renderWorkspaceList(state.workspaces, id);
  ui.showWorkspaceView(workspace, state.pages);
  await loadMembers(id, workspace);
}

// Clic sur un item de la liste — délégation d'événement
// Au lieu d'attacher un listener sur chaque <li>, on en attache un seul sur le parent
// et on identifie la cible avec event.target — plus efficace et ça marche
// même pour les éléments ajoutés dynamiquement après le chargement de la page
document.getElementById('workspace-list').addEventListener('click', (e) => {
  const item = e.target.closest('.workspace-item');
  if (item) selectWorkspace(parseInt(item.dataset.id));
});

document.getElementById('new-workspace-btn').addEventListener('click', async () => {
  const name = prompt('Nom du workspace :');
  if (!name || name.trim().length < 2) return;

  await api.workspaces.create(name.trim());
  await loadWorkspaces();
});

document.getElementById('delete-workspace-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId) return;
  if (!confirm('Supprimer ce workspace et toutes ses pages ?')) return;

  await api.workspaces.delete(state.currentWorkspaceId);
  state.currentWorkspaceId = null;
  state.currentWorkspaceRole = null;
  state.members            = [];
  state.pages              = [];
  await loadWorkspaces();
  ui.showEmptyState();
});

// ── Membres ─────────────────────────────────────────────────────────
document.getElementById('invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId) return;

  ui.clearError('invite-error');
  const email = ui.val('invite-email');
  const role  = document.getElementById('invite-role').value;

  if (!email) {
    ui.showError('invite-error', 'Email requis.');
    return;
  }

  try {
    await api.members.add(state.currentWorkspaceId, email, role);
    ui.clearVal('invite-email');
    await loadMembers(
      state.currentWorkspaceId,
      state.workspaces.find(w => w.id === state.currentWorkspaceId)
    );
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('invite-error', msg);
  }
});

document.getElementById('member-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || !state.currentWorkspaceId) return;

  const userId = parseInt(btn.dataset.userId);
  const action = btn.dataset.action;
  const isSelf = userId === state.currentUser.id;

  if (action === 'remove' && !confirm('Retirer ce membre du workspace ?')) return;
  if (action === 'leave' && !confirm('Quitter ce workspace ?')) return;

  await api.members.remove(state.currentWorkspaceId, userId);

  if (isSelf) {
    state.currentWorkspaceId = null;
    state.currentWorkspaceRole = null;
    state.members = [];
    state.pages = [];
    await loadWorkspaces();
    ui.showEmptyState();
    return;
  }

  await loadMembers(
    state.currentWorkspaceId,
    state.workspaces.find(w => w.id === state.currentWorkspaceId)
  );
});

// ── Pages ────────────────────────────────────────────────────────────
document.getElementById('page-list').addEventListener('click', async (e) => {
  const item = e.target.closest('.page-item');
  if (!item) return;

  const pageId = parseInt(item.dataset.id);
  const data   = await api.pages.get(state.currentWorkspaceId, pageId);
  state.currentPageId = pageId;
  ui.showPageView(data.page);
});

document.getElementById('new-page-btn').addEventListener('click', async () => {
  const title = prompt('Titre de la page :');
  if (!title || title.trim().length < 1) return;

  await api.pages.create(state.currentWorkspaceId, title.trim(), '');
  const data = await api.pages.list(state.currentWorkspaceId);
  state.pages = data.pages;

  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  ui.showWorkspaceView(workspace, state.pages);
});

document.getElementById('save-page-btn').addEventListener('click', async () => {
  if (!state.currentPageId) return;

  const title   = ui.val('page-title-input');
  const content = document.getElementById('page-content-input').value;

  if (!title) { alert('Le titre est requis.'); return; }

  await api.pages.update(state.currentWorkspaceId, state.currentPageId, title, content);

  // Rafraîchit la liste pour refléter le nouveau titre
  const data = await api.pages.list(state.currentWorkspaceId);
  state.pages = data.pages;
  ui.renderPageList(state.pages);
});

document.getElementById('delete-page-btn').addEventListener('click', async () => {
  if (!state.currentPageId) return;
  if (!confirm('Supprimer cette page ?')) return;

  await api.pages.delete(state.currentWorkspaceId, state.currentPageId);
  state.currentPageId = null;

  const data      = await api.pages.list(state.currentWorkspaceId);
  state.pages     = data.pages;
  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  ui.showWorkspaceView(workspace, state.pages);
});

document.getElementById('back-to-workspace-btn').addEventListener('click', () => {
  state.currentPageId = null;
  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  ui.showWorkspaceView(workspace, state.pages);
});

// ── Dashboard ────────────────────────────────────────────────────────
// Charge et affiche le dashboard
async function loadDashboard() {
  const data = await api.dashboard.get();
  ui.renderDashboard(data);
  ui.showDashboard();
  const dashboardBtn = document.getElementById('dashboard-btn');
  if (dashboardBtn) dashboardBtn.classList.add('active');
  // Désélectionne le workspace actif dans la sidebar
  document.querySelectorAll('.workspace-item')
    .forEach(el => el.classList.remove('active'));
}

// Bouton dashboard dans la sidebar
document.getElementById('dashboard-btn').addEventListener('click', loadDashboard);

// ── Comments ───────────────────────────────────────────────────────────
document.getElementById('comments-btn').addEventListener('click', () => {
  const commentContent = document.querySelector('.comment-content');
  const commentsBtn = document.getElementById('comments-btn');
  
  if (commentContent.classList.contains('hidden')) {
    // Afficher les commentaires
    commentContent.classList.remove('hidden');
    commentsBtn.style.background = '#1a1a1a';
    commentsBtn.querySelector('.icon').style.color = 'white';
  } else {
    // Masquer les commentaires
    commentContent.classList.add('hidden');
    commentsBtn.style.background = '#f0f0f0';
    commentsBtn.querySelector('.icon').style.color = '#333';
  }
});

// ── Collaboration ───────────────────────────────────────────────────────
// Bouton pour afficher la section des collaborateurs
document.getElementById('new-collab-btn').addEventListener('click', () => {
  ui.show('workspace-collab');
  ui.refreshIcons();
});

// Bouton pour fermer la section des collaborateurs
document.getElementById('close-collab-btn').addEventListener('click', () => {
  ui.hide('workspace-collab');
  ui.clearError('invite-error');
  ui.clearVal('invite-email');
  ui.refreshIcons();
});

// ── Démarrage ────────────────────────────────────────────────────────
init();
initPasswordToggles();
initLucideIcons();
initSidebarToggle();
