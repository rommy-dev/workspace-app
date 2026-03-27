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
    // Afficher message de succès
    ui.showNotification('Connexion réussie !');
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
    // Afficher message de succès
    ui.showNotification('Inscription réussie !');
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
  
  // Afficher message de succès avant de réinitialiser l'état
  ui.showNotification('Déconnexion réussie !');
  
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
  ui.openModal('logout-modal');
});

document.getElementById('logout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await performLogout();
  ui.closeModal('logout-modal');
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
const modalIds = [
  'workspace-modal',
  'page-modal',
  'workspace-delete-modal',
  'page-delete-modal',
  'logout-modal',
  'member-remove-modal',
  'member-leave-modal',
  'comment-delete-modal',
  'page-title-required-modal'
];
let pendingMemberRemoval = null;
let pendingMemberLeave = null;
let pendingCommentDelete = null;

function isModalOpen(id) {
  const modal = document.getElementById(id);
  return modal && !modal.classList.contains('hidden');
}

function updateModalState() {
  const anyOpen = modalIds.some(id => isModalOpen(id));
  document.body.classList.toggle('modal-open', anyOpen);
}

function initModals() {
  modalIds.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) ui.closeModal(modalId);
    });

    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => ui.closeModal(modalId));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    modalIds.forEach(id => ui.closeModal(id));
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
  // Cacher le profil quand on arrive sur un workspace
  const userInfo = document.getElementById('user-info');
  if (userInfo) userInfo.classList.remove('active');
  ui.renderWorkspaceList(state.workspaces, id);
  ui.showWorkspaceView(workspace, state.pages);
  await loadMembers(id, workspace);

  if (document.body.classList.contains('sidebar-open')) {
    document.body.classList.remove('sidebar-open');
  }
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
  ui.openModal('workspace-modal', 'workspace-name-input', 'workspace-modal-error');
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
    ui.closeModal('workspace-modal');
    ui.clearVal('workspace-name-input');
    ui.showNotification('Workspace créé avec succès !');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('workspace-modal-error', msg);
  }
});

document.getElementById('delete-workspace-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId) return;
  ui.openModal('workspace-delete-modal');
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
  ui.closeModal('workspace-delete-modal');
  ui.showNotification('Workspace supprimé avec succès !');
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
    document.getElementById('invite-role').value = 'editor';
    await loadMembers(state.currentWorkspaceId);
    ui.showNotification('Collaborateur ajouté avec succès !');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('invite-error', msg);
  }
});

async function finalizeMemberRemoval(userId, isSelf) {
  await api.members.remove(state.currentWorkspaceId, userId);

  if (isSelf) {
    state.currentWorkspaceId = null;
    state.currentWorkspaceRole = null;
    state.members            = [];
    state.pages              = [];
    resetCommentsState();
    await loadWorkspaces();
    ui.showEmptyState();
    ui.showNotification('Vous avez quitté le workspace');
  } else {
    await loadMembers(state.currentWorkspaceId);
    ui.showNotification('Collaborateur retiré avec succès !');
  }
}

document.getElementById('member-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn || !state.currentWorkspaceId) return;

  const userId = parseInt(btn.dataset.userId);
  const action = btn.dataset.action;
  const isSelf = userId === state.currentUser.id;

  if (action === 'remove') {
    const member = state.members.find(m => parseInt(m.user_id) === userId);
    const label = document.getElementById('member-remove-name');
    if (label) label.textContent = member?.name || member?.email || 'ce membre';
    pendingMemberRemoval = { userId, isSelf };
    ui.openModal('member-remove-modal');
    return;
  }
  if (action === 'leave') {
    pendingMemberLeave = { userId };
    ui.openModal('member-leave-modal');
    return;
  }

  await finalizeMemberRemoval(userId, isSelf);
});

document.getElementById('member-remove-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !pendingMemberRemoval) return;

  const { userId, isSelf } = pendingMemberRemoval;
  await finalizeMemberRemoval(userId, isSelf);
  ui.closeModal('member-remove-modal');
});

document.getElementById('member-leave-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !pendingMemberLeave) return;

  await finalizeMemberRemoval(pendingMemberLeave.userId, true);
  ui.closeModal('member-leave-modal');
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
  ui.openModal('page-modal', 'page-title-modal-input', 'page-modal-error');
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
    ui.closeModal('page-modal');
    ui.clearVal('page-title-modal-input');
    ui.showNotification('Page créée avec succès !');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('page-modal-error', msg);
  }
});

document.getElementById('save-page-btn').addEventListener('click', async () => {
  if (!state.currentPageId) return;

  const title   = ui.val('page-title-input');
  const content = document.getElementById('page-content-input').value;

  if (!title) {
    ui.openModal('page-title-required-modal');
    return;
  }

  await api.pages.update(state.currentWorkspaceId, state.currentPageId, title, content);

  // Rafraîchit la liste pour refléter le nouveau titre
  const data = await api.pages.list(state.currentWorkspaceId);
  state.pages = data.pages;
  ui.renderPageList(state.pages);
  ui.showNotification('Page sauvegardée avec succès !');
});

document.getElementById('delete-page-btn').addEventListener('click', async () => {
  if (!state.currentPageId) return;
  ui.openModal('page-delete-modal');
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
  ui.closeModal('page-delete-modal');
  ui.showNotification('Page supprimée avec succès !');
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
  // Cacher le profil quand on arrive sur le dashboard
  const userInfo = document.getElementById('user-info');
  if (userInfo) userInfo.classList.remove('active');

  if (document.body.classList.contains('sidebar-open')) {
    document.body.classList.remove('sidebar-open');
  }
}

// Bouton dashboard dans la sidebar
document.getElementById('dashboard-btn').addEventListener('click', loadDashboard);

// ── Profile ──────────────────────────────────────────────────────────
// Charge et affiche le profil
async function loadProfile() {
  try {
    const data = await api.profile.me();
    ui.renderProfile(data.user);
    ui.showProfile();
    // Marquer le user-info comme actif
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.classList.add('active');
    // Désélectionne le workspace actif dans la sidebar
    document.querySelectorAll('.workspace-item')
      .forEach(el => el.classList.remove('active'));
    // Enlever l'active du dashboard
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) dashboardBtn.classList.remove('active');

    if (document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
    }
  } catch (err) {
    alert('Erreur lors du chargement du profil: ' + err.message);
  }
}

// Lien vers le profil depuis le user-info de la sidebar
document.getElementById('user-info').addEventListener('click', loadProfile);

// Ouvre le modal agrandi sur clic avatar dans la vue profil
const profileAvatarImg = document.getElementById('profile-avatar-img');
if (profileAvatarImg) {
  profileAvatarImg.addEventListener('click', (e) => {
    e.stopPropagation();
    const avatarUrl = e.currentTarget.dataset.avatarUrl;
    if (avatarUrl) ui.openAvatarModal(avatarUrl);
  });
}

const avatarModal = document.getElementById('avatar-modal');
if (avatarModal) {
  avatarModal.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close-avatar' || e.target.closest('[data-action="close-avatar"]')) {
      ui.closeAvatarModal();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ui.closeAvatarModal();
  }
});

// Navigation mobile bottom bar
const mobileDashboardBtn = document.getElementById('mobile-dashboard-btn');
const mobileWorkspacesBtn = document.getElementById('mobile-workspaces-btn');
const mobileProfileBtn = document.getElementById('mobile-profile-btn');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

if (mobileDashboardBtn) {
  mobileDashboardBtn.addEventListener('click', async () => {
    await loadDashboard();
    mobileDashboardBtn.classList.add('active');
    mobileWorkspacesBtn?.classList.remove('active');
    mobileProfileBtn?.classList.remove('active');
  });
}

if (mobileWorkspacesBtn) {
  mobileWorkspacesBtn.addEventListener('click', async () => {
    // ouvrir le sidebar en mode mobile pour choisir un workspace
    document.body.classList.toggle('sidebar-open');
    mobileWorkspacesBtn.classList.add('active');
    mobileDashboardBtn?.classList.remove('active');
    mobileProfileBtn?.classList.remove('active');

    if (!state.currentWorkspaceId) {
      ui.showEmptyState();
    } else {
      const workspace = state.workspaces.find(ws => ws.id === state.currentWorkspaceId);
      if (workspace) {
        ui.showWorkspaceView(workspace, state.pages);
      }
    }
  });
}

if (mobileProfileBtn) {
  mobileProfileBtn.addEventListener('click', async () => {
    await loadProfile();
    mobileProfileBtn.classList.add('active');
    mobileDashboardBtn?.classList.remove('active');
    mobileWorkspacesBtn?.classList.remove('active');
  });
}

if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener('click', () => {
    ui.openModal('logout-modal');
  });
}

// Formulaire Infos profile (name, email, avatar upload)
document.getElementById('profile-info-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  ui.clearError('profile-info-error');

  const name = ui.val('profile-name-input');
  const email = ui.val('profile-email-input');
  const avatarFileInput = document.getElementById('profile-avatar-file');
  const avatarFile = avatarFileInput?.files?.[0];

  // Validation client
  if (!name || name.length < 2) {
    ui.showError('profile-info-error', 'Le nom doit faire au moins 2 caractères.');
    return;
  }
  if (!email) {
    ui.showError('profile-info-error', 'L\'email est requis.');
    return;
  }

  try {
    let latestUser = null;

    // 1. Upload avatar si fichier présent
    if (avatarFile) {
      const uploadData = await api.profile.uploadAvatar(avatarFile);
      latestUser = uploadData.user;
      ui.renderProfile(latestUser); // Refresh affichage avec nouvel avatar
    }

    // 2. Toujours mettre à jour nom/email
    const updateData = await api.profile.update(name, email, latestUser?.avatar_url || state.currentUser?.avatar_url);
    latestUser = updateData.user;

    // Mettre à jour le state
    state.currentUser = {
      ...state.currentUser,
      name: latestUser.name,
      email: latestUser.email,
      avatar_url: latestUser.avatar_url,
    };
    
    // Mettre à jour la sidebar
    ui.showAppScreen(state.currentUser);
    
    // Rafraîchir l'affichage du profil
    ui.renderProfile(latestUser);
    
    // Afficher message de succès avec popup
    ui.showNotification('Profil mis à jour avec succès.');
    
    // Nettoyer les erreurs
    ui.clearError('profile-info-error');
  } catch (err) {
    console.error('Profile update error:', err);
    const msg = err.errors
      ? Object.values(err.errors).join(' ')
      : err.message;
    ui.showError('profile-info-error', msg);
  }
});

// Formulaire Mot de passe
document.getElementById('profile-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  ui.clearError('profile-password-error');

  const currentPassword = ui.val('profile-current-password');
  const newPassword = ui.val('profile-new-password');
  const confirmPassword = ui.val('profile-confirm-password');

  // Validation client
  if (!currentPassword) {
    ui.showError('profile-password-error', 'Veuillez entrer votre mot de passe actuel.');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    ui.showError('profile-password-error', 'Le nouveau mot de passe doit faire au moins 8 caractères.');
    return;
  }
  if (newPassword !== confirmPassword) {
    ui.showError('profile-password-error', 'Les deux mots de passe ne correspondent pas.');
    return;
  }

  try {
    await api.profile.updatePassword(currentPassword, newPassword);
    // Vider les champs
    ui.clearVal('profile-current-password');
    ui.clearVal('profile-new-password');
    ui.clearVal('profile-confirm-password');
    
    // Afficher message de succès avec popup
    ui.showNotification('Mot de passe changé avec succès.');
    
    // Nettoyer les erreurs
    ui.clearError('profile-password-error');
  } catch (err) {
    const msg = err.errors
      ? Object.values(err.errors).join(' ')
      : err.message;
    ui.showError('profile-password-error', msg);
  }
});

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
      ui.showNotification('Commentaire modifié avec succès !');
    } else {
      await api.comments.create(state.currentWorkspaceId, state.currentPageId, content);
      ui.showNotification('Commentaire ajouté avec succès !');
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
    pendingCommentDelete = commentId;
    ui.openModal('comment-delete-modal');
  }
});

document.getElementById('comment-delete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !state.currentPageId || !pendingCommentDelete) return;

  const commentId = pendingCommentDelete;
  await api.comments.delete(state.currentWorkspaceId, state.currentPageId, commentId);
  if (state.editingCommentId === commentId) {
    state.editingCommentId = null;
    clearCommentForm();
  }
  await loadComments(state.currentWorkspaceId, state.currentPageId);
  ui.closeModal('comment-delete-modal');
  ui.showNotification('Commentaire supprimé avec succès !');
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
