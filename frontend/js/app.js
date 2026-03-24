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

async function performLogout() {
  await api.auth.logout();
  
  // Réinitialise l'état complet
  state.currentUser        = null;
  state.workspaces         = [];
  state.currentWorkspaceId = null;
  state.currentWorkspaceRole = null;
  state.members            = [];
  state.pages              = [];
  state.currentPageId      = null;
  state.comments           = [];
  state.commentsOpen       = false;
  state.editingCommentId   = null;
  resetCommentsState();
  
  // Ferme la page active et retourne à l'état initial
  ui.showEmptyState();
  
  // Affiche l'écran d'authentification
  ui.showAuthScreen();
  
  // Ferme la page active après déconnexion
  setTimeout(() => {
    closeCurrentPage();
  }, 500); // Délai pour permettre la déconnexion complète
}

document.getElementById('logout-btn').addEventListener('click', () => {
  openModal('logout-modal');
});

document.getElementById('logout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await performLogout();
  closeModal('logout-modal');
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

// ── Modals ──────────────────────────────────────────────────────────
const modalIds = ['workspace-modal', 'page-modal', 'workspace-delete-modal', 'page-delete-modal', 'logout-modal'];

function isModalOpen(id) {
  const modal = document.getElementById(id);
  return modal && !modal.classList.contains('hidden');
}

function updateModalState() {
  const anyOpen = modalIds.some(id => isModalOpen(id));
  document.body.classList.toggle('modal-open', anyOpen);
}

function openModal(modalId, inputId, errorId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  if (errorId) ui.clearError(errorId);
  if (inputId) {
    ui.setVal(inputId, '');
    const input = document.getElementById(inputId);
    if (input) setTimeout(() => input.focus(), 0);
  }

  updateModalState();
  ui.refreshIcons();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  updateModalState();
}

function initModals() {
  modalIds.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modalId);
    });

    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(modalId));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    modalIds.forEach(id => closeModal(id));
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
  resetCommentsState();

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

document.getElementById('new-workspace-btn').addEventListener('click', () => {
  openModal('workspace-modal', 'workspace-name-input', 'workspace-modal-error');
});

document.getElementById('workspace-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  ui.clearError('workspace-modal-error');

  const name = ui.val('workspace-name-input');
  if (!name || name.length < 2) {
    ui.showError('workspace-modal-error', 'Le nom doit contenir au moins 2 caractères.');
    return;
  }

  try {
    await api.workspaces.create(name.trim());
    await loadWorkspaces();
    closeModal('workspace-modal');
    ui.clearVal('workspace-name-input');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('workspace-modal-error', msg);
  }
});

document.getElementById('delete-workspace-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId) return;
  openModal('workspace-delete-modal');
});

document.getElementById('workspace-delete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId) return;

  await api.workspaces.delete(state.currentWorkspaceId);
  state.currentWorkspaceId = null;
  state.currentWorkspaceRole = null;
  state.members            = [];
  state.pages              = [];
  resetCommentsState();
  await loadWorkspaces();
  ui.showEmptyState();
  closeModal('workspace-delete-modal');
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
    resetCommentsState();
    await loadWorkspaces();
    ui.showEmptyState();
    return;
  }

  await loadMembers(
    state.currentWorkspaceId,
    state.workspaces.find(w => w.id === state.currentWorkspaceId)
  );
});

// ── Commentaires helpers ────────────────────────────────────────────
function canDeleteAnyComments() {
  return state.currentWorkspaceRole === 'owner';
}

function setCommentFormMode(isEditing) {
  const cancelBtn = document.getElementById('comment-cancel-btn');
  const submitBtn = document.getElementById('comment-submit-btn');
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !isEditing);
  if (submitBtn) submitBtn.textContent = isEditing ? 'Mettre à jour' : 'Publier';
}

function clearCommentForm() {
  ui.clearVal('comment-input');
  ui.clearError('comment-error');
  setCommentFormMode(false);
}

function resetCommentsState() {
  state.comments = [];
  state.commentsOpen = false;
  state.editingCommentId = null;
  ui.setCommentsCount(0);
  ui.renderComments([], state.currentUser ? state.currentUser.id : 0, canDeleteAnyComments());
  ui.toggleCommentsPanel(false);
  clearCommentForm();
}

async function loadComments(workspaceId, pageId) {
  try {
    const data = await api.comments.list(workspaceId, pageId);
    state.comments = data.comments;
    ui.setCommentsCount(state.comments.length);
    ui.renderComments(state.comments, state.currentUser.id, canDeleteAnyComments());
  } catch (err) {
    state.comments = [];
    ui.setCommentsCount(0);
    ui.renderComments([], state.currentUser.id, canDeleteAnyComments());
    ui.showError('comment-error', err.message);
  }
}

// ── Pages ────────────────────────────────────────────────────────────
document.getElementById('page-list').addEventListener('click', async (e) => {
  const item = e.target.closest('.page-item');
  if (!item) return;

  const pageId = parseInt(item.dataset.id);
  const data   = await api.pages.get(state.currentWorkspaceId, pageId);
  state.currentPageId = pageId;
  ui.showPageView(data.page);
  resetCommentsState();
  await loadComments(state.currentWorkspaceId, pageId);
});

document.getElementById('new-page-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId) return;
  openModal('page-modal', 'page-title-modal-input', 'page-modal-error');
});

document.getElementById('page-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId) return;

  ui.clearError('page-modal-error');
  const title = ui.val('page-title-modal-input');

  if (!title || title.length < 1) {
    ui.showError('page-modal-error', 'Le titre est requis.');
    return;
  }

  try {
    await api.pages.create(state.currentWorkspaceId, title.trim(), '');
    const data = await api.pages.list(state.currentWorkspaceId);
    state.pages = data.pages;

    const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
    ui.showWorkspaceView(workspace, state.pages);
    closeModal('page-modal');
    ui.clearVal('page-title-modal-input');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('page-modal-error', msg);
  }
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
  openModal('page-delete-modal');
});

document.getElementById('page-delete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentPageId) return;

  await api.pages.delete(state.currentWorkspaceId, state.currentPageId);
  state.currentPageId = null;
  resetCommentsState();

  const data      = await api.pages.list(state.currentWorkspaceId);
  state.pages     = data.pages;
  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  ui.showWorkspaceView(workspace, state.pages);
  closeModal('page-delete-modal');
});

document.getElementById('back-to-workspace-btn').addEventListener('click', () => {
  state.currentPageId = null;
  resetCommentsState();
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
document.getElementById('comments-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId || !state.currentPageId) return;

  state.commentsOpen = !state.commentsOpen;
  ui.toggleCommentsPanel(state.commentsOpen);

  if (state.commentsOpen && state.comments.length === 0) {
    await loadComments(state.currentWorkspaceId, state.currentPageId);
  }
});

document.getElementById('comments-close-btn').addEventListener('click', () => {
  state.commentsOpen = false;
  ui.toggleCommentsPanel(false);
});

document.getElementById('comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !state.currentPageId) return;

  ui.clearError('comment-error');
  const content = ui.val('comment-input');

  if (!content) {
    ui.showError('comment-error', 'Le commentaire ne peut pas être vide.');
    return;
  }

  try {
    if (state.editingCommentId) {
      await api.comments.update(
        state.currentWorkspaceId,
        state.currentPageId,
        state.editingCommentId,
        content
      );
    } else {
      await api.comments.create(state.currentWorkspaceId, state.currentPageId, content);
    }

    state.editingCommentId = null;
    clearCommentForm();
    await loadComments(state.currentWorkspaceId, state.currentPageId);
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('comment-error', msg);
  }
});

document.getElementById('comment-cancel-btn').addEventListener('click', () => {
  state.editingCommentId = null;
  clearCommentForm();
});

document.getElementById('comments-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || !state.currentWorkspaceId || !state.currentPageId) return;

  const commentId = parseInt(btn.dataset.id);
  const action = btn.dataset.action;

  if (action === 'toggle') {
    const item = btn.closest('.comment-item');
    const body = item ? item.querySelector('.comment-body') : null;
    if (!body) return;
    const expanded = body.dataset.expanded === 'true';
    body.textContent = expanded ? body.dataset.short : body.dataset.full;
    body.dataset.expanded = expanded ? 'false' : 'true';
    btn.textContent = expanded ? 'Voir plus' : 'Voir moins';
    return;
  }

  if (action === 'edit') {
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment) return;
    state.editingCommentId = commentId;
    ui.setVal('comment-input', comment.content);
    setCommentFormMode(true);
    document.getElementById('comment-input').focus();
    return;
  }

  if (action === 'delete') {
    if (!confirm('Supprimer ce commentaire ?')) return;
    await api.comments.delete(state.currentWorkspaceId, state.currentPageId, commentId);
    if (state.editingCommentId === commentId) {
      state.editingCommentId = null;
      clearCommentForm();
    }
    await loadComments(state.currentWorkspaceId, state.currentPageId);
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
initModals();
