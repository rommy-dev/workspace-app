// ── Persistance de vue ──────────────────────────────────────────────
const VIEW_STATE_KEY = 'viewState';

function parseMaybeInt(value) {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSavedViewState() {
  const raw = localStorage.getItem(VIEW_STATE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem(VIEW_STATE_KEY);
    }
  }

  const legacyView = localStorage.getItem('currentView');
  if (!legacyView) return null;

  return {
    currentView: legacyView,
    currentWorkspaceId: parseMaybeInt(localStorage.getItem('currentWorkspaceId')),
    currentPageId: parseMaybeInt(localStorage.getItem('currentPageId')),
    currentPageSource: localStorage.getItem('currentPageSource') || null,
    currentPagePermission: null,
  };
}

function clearLegacyViewState() {
  localStorage.removeItem('currentView');
  localStorage.removeItem('currentWorkspaceId');
  localStorage.removeItem('currentPageId');
  localStorage.removeItem('currentPageSource');
}

// ── Sauvegarde d'état ──────────────────────────────────────────────────
function saveViewState() {
  const payload = {
    currentView: state.currentView,
    currentWorkspaceId: state.currentWorkspaceId,
    currentPageId: state.currentPageId,
    currentPageSource: state.currentPageSource,
    currentPagePermission: state.currentPagePermission,
  };
  localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(payload));
  clearLegacyViewState();
}

async function restoreView(savedState) {
  switch (savedState.currentView) {
    case 'workspace': {
      if (!savedState.currentWorkspaceId) {
        await loadDashboard();
        return;
      }
      await selectWorkspace(savedState.currentWorkspaceId);
      if (savedState.currentPageId) {
        const page = state.pages.find(p => p.id === savedState.currentPageId);
        if (page) {
          const pageData = await api.pages.get(savedState.currentWorkspaceId, savedState.currentPageId);
          state.currentPageId = savedState.currentPageId;
          state.currentPageSource = 'workspace';
          state.currentPagePermission = null;
          state.currentView = 'workspace';
          ui.showPageView(pageData.page);
          ui.setShareButtonVisible(true);
          ui.setCommentsAvailable(true);
          resetCommentsState();
          await loadComments(savedState.currentWorkspaceId, savedState.currentPageId);
          saveViewState();
        }
      }
      return;
    }
    case 'profile':
      if (!(await loadProfile())) {
        await loadDashboard();
      }
      return;
    case 'shared-pages':
      if (!(await loadSharedPages())) {
        await loadDashboard();
        return;
      }
      if (
        savedState.currentPageSource === 'shared' &&
        savedState.currentWorkspaceId &&
        savedState.currentPageId
      ) {
        await openSharedPage(
          savedState.currentWorkspaceId,
          savedState.currentPageId,
          savedState.currentPagePermission
        );
      }
      return;
    default:
      await loadDashboard();
  }
}

// ── Initialisation ──────────────────────────────────────────────────
// Vérifie si une session existe déjà (rechargement de page)
async function init() {
  try {
    const data = await api.auth.me();
    state.currentUser = data.user;
    ui.showAppScreen(data.user);
    await loadWorkspaces();
  } catch {
    // Pas de session active — on affiche l'écran de connexion
    ui.showAuthScreen();
    return;
  }

  const savedState = getSavedViewState();
  if (!savedState || savedState.currentView === 'empty') {
    // Premier démarrage ou aucune vue sauvegardée → dashboard par défaut
    await loadDashboard();
    return;
  }

  try {
    await restoreView(savedState);
  } catch (err) {
    console.warn('View restore failed, fallback to dashboard.', err);
    await loadDashboard();
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
const AUTH_FIELD_RULES = {
  'login-email': {
    required: true,
    validator: value => isEmailValid(value),
    invalidMessage: 'Email invalide.',
    validMessage: 'Email valide.'
  },
  'login-password': {
    required: true,
    validator: value => value.length > 0,
    invalidMessage: 'Mot de passe requis.',
    validMessage: 'Champ correct.'
  },
  'register-name': {
    required: true,
    validator: value => value.length >= 2,
    invalidMessage: 'Nom complet requis (2 caractères min).',
    validMessage: 'Champ correct.'
  },
  'register-email': {
    required: true,
    validator: value => isEmailValid(value),
    invalidMessage: 'Email invalide.',
    validMessage: 'Email valide.'
  },
  'register-password': {
    required: true,
    validator: value => value.length >= 8,
    invalidMessage: '8 caractères minimum.',
    validMessage: 'Mot de passe valide.'
  },
};

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setFieldFeedback(input, state, message) {
  const field = input.closest('.form-field');
  if (!field) return;
  const feedback = field.querySelector('.field-feedback');
  const messageEl = field.querySelector('.field-message');
  const iconEl = field.querySelector('.field-status-icon');
  if (!feedback || !messageEl) return;

  feedback.classList.remove('is-valid', 'is-invalid');
  input.classList.remove('is-valid', 'is-invalid');

  if (state === 'neutral') {
    messageEl.textContent = '';
    return;
  }

  feedback.classList.add(state === 'valid' ? 'is-valid' : 'is-invalid');
  input.classList.add(state === 'valid' ? 'is-valid' : 'is-invalid');
  messageEl.textContent = message;

  if (iconEl) {
    iconEl.setAttribute('data-lucide', state === 'valid' ? 'check-circle' : 'alert-circle');
    ui.refreshIcons();
  }
}

function evaluateAuthField(input, { showFeedback = true } = {}) {
  const rule = AUTH_FIELD_RULES[input.id];
  if (!rule) return true;

  const value = input.value.trim();
  if (!value) {
    if (showFeedback) setFieldFeedback(input, 'neutral', '');
    input.setAttribute('aria-invalid', 'false');
    return false;
  }

  const valid = rule.validator(value);
  input.setAttribute('aria-invalid', valid ? 'false' : 'true');

  if (showFeedback) {
    setFieldFeedback(
      input,
      valid ? 'valid' : 'invalid',
      valid ? rule.validMessage : rule.invalidMessage
    );
  }

  return valid;
}

function validateAuthForm(formType, showFeedback = true) {
  const fieldIds = formType === 'login'
    ? ['login-email', 'login-password']
    : ['register-name', 'register-email', 'register-password'];

  return fieldIds.every((id) => {
    const input = document.getElementById(id);
    if (!input) return false;
    return evaluateAuthField(input, { showFeedback });
  });
}

function updatePasswordStrength(value) {
  const strengthEl = document.getElementById('register-password-strength');
  if (!strengthEl) return;
  const meter = strengthEl.querySelector('.strength-meter span');
  const text = strengthEl.querySelector('.strength-text');
  const trimmed = value.trim();

  if (!trimmed) {
    strengthEl.classList.remove('strength-weak', 'strength-medium', 'strength-strong');
    if (meter) meter.style.width = '0%';
    if (text) text.textContent = 'Mot de passe sécurisé';
    return;
  }

  if (trimmed.length < 8) {
    strengthEl.classList.remove('strength-weak', 'strength-medium', 'strength-strong');
    strengthEl.classList.add('strength-weak');
    if (meter) {
      const percent = Math.max(10, Math.round((trimmed.length / 8) * 40));
      meter.style.width = `${percent}%`;
    }
    if (text) text.textContent = 'Sécurité : Faible';
    return;
  }

  let score = 1;
  if (/[a-z]/.test(trimmed)) score += 1;
  if (/[A-Z]/.test(trimmed)) score += 1;
  if (/[0-9]/.test(trimmed)) score += 1;
  if (/[^A-Za-z0-9]/.test(trimmed)) score += 1;

  const percent = Math.min(100, Math.round((score / 5) * 100));
  if (meter) meter.style.width = `${percent}%`;

  strengthEl.classList.remove('strength-weak', 'strength-medium', 'strength-strong');

  let label = 'Faible';
  let strengthClass = 'strength-weak';
  if (score >= 4) {
    label = 'Fort';
    strengthClass = 'strength-strong';
  } else if (score >= 3) {
    label = 'Moyen';
    strengthClass = 'strength-medium';
  }

  strengthEl.classList.add(strengthClass);
  if (text) text.textContent = `Sécurité : ${label}`;
}

function updateAuthButtons() {
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');

  const loginValid = validateAuthForm('login', false);
  const registerValid = validateAuthForm('register', false);

  if (loginBtn && !loginBtn.classList.contains('is-loading')) {
    loginBtn.disabled = !loginValid;
  }
  if (registerBtn && !registerBtn.classList.contains('is-loading')) {
    registerBtn.disabled = !registerValid;
  }
}

function resetAuthForm(formType) {
  const form = document.getElementById(`${formType}-form`);
  if (!form) return;
  form.querySelectorAll('input').forEach((input) => {
    input.classList.remove('is-valid', 'is-invalid');
    input.setAttribute('aria-invalid', 'false');
    setFieldFeedback(input, 'neutral', '');
  });
  if (formType === 'register') {
    updatePasswordStrength('');
  }
  updateAuthButtons();
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;
  const textEl = button.querySelector('.btn-text');
  if (!button.dataset.defaultText && textEl) {
    button.dataset.defaultText = textEl.textContent.trim();
  }
  if (textEl) {
    textEl.textContent = isLoading
      ? loadingText
      : (button.dataset.defaultText || textEl.textContent);
  }
  button.classList.toggle('is-loading', isLoading);
  button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  if (isLoading) {
    button.disabled = true;
  }
}

function focusAuthFirstInput(tabName) {
  const form = document.getElementById(`${tabName}-form`);
  if (!form) return;
  const firstInput = form.querySelector('input');
  if (firstInput) firstInput.focus();
}

function getActiveAuthTab() {
  const loginForm = document.getElementById('login-form');
  if (loginForm && !loginForm.classList.contains('hidden')) return 'login';
  const registerForm = document.getElementById('register-form');
  if (registerForm && !registerForm.classList.contains('hidden')) return 'register';
  return 'login';
}

function switchAuthTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.toggle('hidden', form.id !== `${tabName}-form`);
  });
  ui.clearError('login-error');
  ui.clearError('register-error');
  focusAuthFirstInput(tabName);
  updateAuthButtons();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  ui.clearError('login-error');

  if (!validateAuthForm('login', true)) {
    updateAuthButtons();
    return;
  }

  const email = ui.val('login-email');
  const password = ui.val('login-password');
  const loginBtn = document.getElementById('login-btn');

  setButtonLoading(loginBtn, true, 'Connexion...');

  try {
    const data = await api.auth.login(email, password);
    state.currentUser = data.user;
    ui.clearVal('login-email');
    ui.clearVal('login-password');
    resetAuthForm('login');
    ui.clearError('login-error');
    ui.showAppScreen(data.user);
    await loadWorkspaces();
    // Affiche le dashboard par défaut après connexion
    await loadDashboard();
    // Afficher message de succès
    ui.showNotification('Connexion réussie !');
  } catch (err) {
    ui.showError('login-error', err.message);
  } finally {
    setButtonLoading(loginBtn, false);
    updateAuthButtons();
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  ui.clearError('register-error');

  if (!validateAuthForm('register', true)) {
    updateAuthButtons();
    return;
  }

  const name = ui.val('register-name');
  const email = ui.val('register-email');
  const password = ui.val('register-password');
  const registerBtn = document.getElementById('register-btn');

  setButtonLoading(registerBtn, true, 'Création...');

  try {
    const data = await api.auth.register(name, email, password);
    state.currentUser = data.user;
    ui.clearVal('register-name');
    ui.clearVal('register-email');
    ui.clearVal('register-password');
    resetAuthForm('register');
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
  } finally {
    setButtonLoading(registerBtn, false);
    updateAuthButtons();
  }
}

function initAuthEnhancements() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);

  document.querySelectorAll('#auth-screen input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.id === 'register-password') {
        updatePasswordStrength(input.value);
      }
      evaluateAuthField(input, { showFeedback: true });
      if (input.closest('#login-form')) {
        ui.clearError('login-error');
      } else {
        ui.clearError('register-error');
      }
      updateAuthButtons();
    });

    input.addEventListener('blur', () => {
      evaluateAuthField(input, { showFeedback: true });
      updateAuthButtons();
    });
  });

  document.querySelectorAll('[data-switch-auth]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthTab(link.dataset.switchAuth);
    });
  });

  updatePasswordStrength('');
  updateAuthButtons();
  focusAuthFirstInput('login');
}

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
  state.currentPageSource  = null;
  state.currentPagePermission = null;
  state.pageShares         = [];
  state.sharedPages        = [];
  state.comments           = [];
  state.commentsOpen       = false;
  state.editingCommentId   = null;
  resetCommentsState();
  
  // Sauvegarder l'état vide
  state.currentView = 'empty';
  saveViewState();
  
  // Ferme la page active et retourne à l'état initial
  ui.showEmptyState();
  
  // Affiche l'écran d'authentification
  ui.showAuthScreen();
  focusAuthFirstInput(getActiveAuthTab());
  updateAuthButtons();
  
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
  'share-modal',
  'workspace-delete-modal',
  'page-delete-modal',
  'logout-modal',
  'member-remove-modal',
  'member-leave-modal',
  'share-remove-modal',
  'comment-delete-modal',
  'page-title-required-modal',
  'workspace-update-modal'
];
let pendingMemberRemoval = null;
let pendingMemberLeave = null;
let pendingCommentDelete = null;
let pendingShareRemoval = null;

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

async function loadSharedPages() {
  try {
    const data = await api.shares.listShared();
    state.sharedPages = data.pages || [];
    ui.renderSharedPageList(state.sharedPages);
    ui.showSharedPagesView();

    state.currentView = 'shared-pages';
    state.currentWorkspaceId = null;
    state.currentWorkspaceRole = null;
    state.currentPageId = null;
    state.currentPageSource = null;
    state.currentPagePermission = null;
    state.pageShares = [];
    resetCommentsState();
    saveViewState();

    const sharedBtn = document.getElementById('shared-pages-btn');
    if (sharedBtn) sharedBtn.classList.add('active');
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) dashboardBtn.classList.remove('active');
    const mobileSharedBtn = document.getElementById('mobile-shared-btn');
    if (mobileSharedBtn) mobileSharedBtn.classList.add('active');
    const mobileDashboardBtn = document.getElementById('mobile-dashboard-btn');
    if (mobileDashboardBtn) mobileDashboardBtn.classList.remove('active');
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    if (mobileProfileBtn) mobileProfileBtn.classList.remove('active');
    document.querySelectorAll('.workspace-item')
      .forEach(el => el.classList.remove('active'));
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.classList.remove('active');

    if (document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
    }
    return true;
  } catch (err) {
    ui.showNotification('Erreur lors du chargement des pages partagées.');
    return false;
  }
}

async function loadPageShares(workspaceId, pageId) {
  try {
    const data = await api.shares.list(workspaceId, pageId);
    state.pageShares = data.shares || [];
    ui.renderShareList(state.pageShares);
    ui.setShareTotal(state.pageShares.length);
  } catch (err) {
    state.pageShares = [];
    ui.renderShareList([]);
    ui.setShareTotal(0);
    ui.showError('share-error', err.message);
  }
}

async function selectWorkspace(id) {
  state.currentWorkspaceId = id;
  state.currentPageId      = null;
  state.currentPageSource  = 'workspace';
  state.currentPagePermission = null;
  state.currentView = 'workspace';
  resetCommentsState();

  const data = await api.pages.list(id);
  state.pages = data.pages;

  const workspace = state.workspaces.find(w => w.id === id);
  const dashboardBtn = document.getElementById('dashboard-btn');
  if (dashboardBtn) dashboardBtn.classList.remove('active');
  const sharedBtn = document.getElementById('shared-pages-btn');
  if (sharedBtn) sharedBtn.classList.remove('active');
  const mobileSharedBtn = document.getElementById('mobile-shared-btn');
  if (mobileSharedBtn) mobileSharedBtn.classList.remove('active');
  // Cacher le profil quand on arrive sur un workspace
  const userInfo = document.getElementById('user-info');
  if (userInfo) userInfo.classList.remove('active');
  ui.renderWorkspaceList(state.workspaces, id);
  ui.showWorkspaceView(workspace, state.pages);
  await loadMembers(id, workspace);

  // Sauvegarder l'état de la vue
  saveViewState();

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

// Bouton CTA du dashboard pour créer un workspace
document.getElementById('dashboard-create-workspace-btn').addEventListener('click', () => {
  document.getElementById('new-workspace-btn').click();
});

// Titre Workspaces cliquable pour créer un workspace
document.querySelector('#sidebar-header .workspace-sidebar-header h2').addEventListener('click', () => {
  document.getElementById('new-workspace-btn').click();
});

// Bouton mobile pour créer un workspace
document.getElementById('mobile-new-workspace-btn').addEventListener('click', () => {
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

document.getElementById('update-workspace-title-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId) return;
  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  if (!workspace) return;
  
  ui.setVal('workspace-update-name-input', workspace.name);
  ui.openModal('workspace-update-modal', 'workspace-update-name-input', 'workspace-update-error');
});

document.getElementById('workspace-update-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId) return;
  
  ui.clearError('workspace-update-error');
  const name = ui.val('workspace-update-name-input');
  
  if (!name || name.length < 2) {
    ui.showError('workspace-update-error', 'Le nom doit contenir au moins 2 caractères.');
    return;
  }

  try {
    const data = await api.workspaces.update(state.currentWorkspaceId, name.trim());
    
    // Mettre à jour le workspace dans l'état
    const wsIndex = state.workspaces.findIndex(w => w.id === state.currentWorkspaceId);
    if (wsIndex !== -1) {
      state.workspaces[wsIndex] = data.workspace;
    }
    
    // Rafraîchir l'affichage
    ui.renderWorkspaceList(state.workspaces, state.currentWorkspaceId);
    ui.text('workspace-title', data.workspace.name);
    
    ui.closeModal('workspace-update-modal');
    ui.clearVal('workspace-update-name-input');
    ui.showNotification('Workspace modifié avec succès !');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('workspace-update-error', msg);
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
  
  // Sauvegarder l'état vide
  state.currentView = 'empty';
  saveViewState();
  
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
    
    // Sauvegarder l'état vide
    state.currentView = 'empty';
    saveViewState();
    
    await loadWorkspaces();
    ui.showEmptyState();
    ui.showNotification('Vous avez quitté le workspace');
  } else {
    await loadMembers(state.currentWorkspaceId);
    ui.showNotification('Collaborateur retiré avec succès !');
  }
}

document.getElementById('member-list').addEventListener('click', async (e) => {
  // Handle avatar clicks
  const avatar = e.target.closest('.member-avatar');
  if (avatar && avatar.dataset.avatarUrl) {
    ui.openAvatarModal(avatar.dataset.avatarUrl);
    return;
  }

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
  state.currentPageSource = 'workspace';
  state.currentPagePermission = null;
  ui.showPageView(data.page);
  ui.setShareButtonVisible(true);
  ui.setCommentsAvailable(true);
  resetCommentsState();
  await loadComments(state.currentWorkspaceId, pageId);
  
  // Sauvegarder l'état de la vue
  saveViewState();
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

  if (state.currentPageSource === 'shared') {
    ui.showNotification('Page sauvegardée avec succès !');
    return;
  }

  // Rafraîchit la liste pour refléter le nouveau titre
  const data = await api.pages.list(state.currentWorkspaceId);
  state.pages = data.pages;
  ui.renderPageList(state.pages);
  ui.showNotification('Page sauvegardée avec succès !');
});

document.getElementById('delete-page-btn').addEventListener('click', async () => {
  if (!state.currentPageId) return;
  if (state.currentPageSource === 'shared') return;
  ui.openModal('page-delete-modal');
});

document.getElementById('page-delete-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentPageId) return;
  if (state.currentPageSource === 'shared') return;

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

// ── Partage de page ─────────────────────────────────────────────────
document.getElementById('share-page-btn').addEventListener('click', async () => {
  if (!state.currentWorkspaceId || !state.currentPageId) return;
  ui.openModal('share-modal', 'share-email-input', 'share-error');
  const permissionSelect = document.getElementById('share-permission-select');
  if (permissionSelect) permissionSelect.value = 'read';
  await loadPageShares(state.currentWorkspaceId, state.currentPageId);
});

document.getElementById('share-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !state.currentPageId) return;

  ui.clearError('share-error');
  const email = ui.val('share-email-input');
  const permission = document.getElementById('share-permission-select')?.value || 'read';

  if (!email) {
    ui.showError('share-error', 'Email requis.');
    return;
  }

  try {
    await api.shares.create(state.currentWorkspaceId, state.currentPageId, email, permission);
    ui.clearVal('share-email-input');
    await loadPageShares(state.currentWorkspaceId, state.currentPageId);
    ui.showNotification('Partage ajouté avec succès !');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('share-error', msg);
  }
});

document.getElementById('share-list').addEventListener('change', async (e) => {
  const select = e.target.closest('select[data-action="permission"]');
  if (!select || !state.currentWorkspaceId || !state.currentPageId) return;

  const userId = parseInt(select.dataset.userId);
  const permission = select.value;

  try {
    await api.shares.update(state.currentWorkspaceId, state.currentPageId, userId, permission);
    await loadPageShares(state.currentWorkspaceId, state.currentPageId);
    ui.showNotification('Permissions mises à jour.');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('share-error', msg);
  }
});

document.getElementById('share-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="remove"]');
  if (!btn) return;

  const userId = parseInt(btn.dataset.userId);
  const share = state.pageShares.find(s => parseInt(s.user_id) === userId);
  const label = document.getElementById('share-remove-name');
  if (label) label.textContent = share?.name || share?.email || 'cet utilisateur';
  pendingShareRemoval = { userId };
  ui.openModal('share-remove-modal');
});

document.getElementById('share-remove-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentWorkspaceId || !state.currentPageId || !pendingShareRemoval) return;

  try {
    await api.shares.remove(state.currentWorkspaceId, state.currentPageId, pendingShareRemoval.userId);
    pendingShareRemoval = null;
    await loadPageShares(state.currentWorkspaceId, state.currentPageId);
    ui.closeModal('share-remove-modal');
    ui.showNotification('Accès retiré avec succès.');
  } catch (err) {
    const msg = err.errors ? Object.values(err.errors).join(' ') : err.message;
    ui.showError('share-error', msg);
  }
});

async function openSharedPage(workspaceId, pageId, permission) {
  const data = await api.pages.get(workspaceId, pageId);
  state.currentWorkspaceId = workspaceId;
  state.currentWorkspaceRole = null;
  state.currentPageId = pageId;
  state.currentPageSource = 'shared';
  state.currentPagePermission = permission || 'read';
  state.currentView = 'shared-pages';

  ui.showPageView(data.page);
  ui.setShareButtonVisible(false);
  ui.setCommentsAvailable(false);
  ui.setWorkspaceActions({
    canDeleteWorkspace: false,
    canEditPages: (permission || 'read') === 'edit',
    canDeletePage: false,
  });
  resetCommentsState();

  // Sauvegarder l'état de la vue
  saveViewState();
}

document.getElementById('shared-page-list').addEventListener('click', async (e) => {
  const item = e.target.closest('.shared-page-item');
  if (!item) return;

  const workspaceId = parseInt(item.dataset.workspaceId);
  const pageId = parseInt(item.dataset.pageId);
  const permission = item.dataset.permission;

  await openSharedPage(workspaceId, pageId, permission);
});

document.getElementById('back-to-workspace-btn').addEventListener('click', () => {
  const wasShared = state.currentPageSource === 'shared';
  state.currentPageId = null;
  state.pageShares = [];
  state.currentPageSource = null;
  state.currentPagePermission = null;
  resetCommentsState();
  if (wasShared) {
    ui.showSharedPagesView();
    ui.renderSharedPageList(state.sharedPages);
    ui.setCommentsAvailable(true);
    ui.setShareButtonVisible(true);
    state.currentWorkspaceId = null;
    state.currentWorkspaceRole = null;
    state.currentView = 'shared-pages';
    saveViewState();
    return;
  }
  const workspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  ui.showWorkspaceView(workspace, state.pages);
  state.currentView = 'workspace';
  saveViewState();
});

// ── Dashboard ────────────────────────────────────────────────────────
// Charge et affiche le dashboard
async function loadDashboard(period = '7d') {
  const data = await api.dashboard.get(period);
  ui.renderDashboard(data);
  ui.showDashboard();
  
  // Sauvegarder l'état de la vue
  state.currentView = 'dashboard';
  state.currentWorkspaceId = null;
  state.currentWorkspaceRole = null;
  state.currentPageId = null;
  state.currentPageSource = null;
  state.currentPagePermission = null;
  state.pageShares = [];
  resetCommentsState();
  saveViewState();
  
  const dashboardBtn = document.getElementById('dashboard-btn');
  if (dashboardBtn) dashboardBtn.classList.add('active');
  const sharedBtn = document.getElementById('shared-pages-btn');
  if (sharedBtn) sharedBtn.classList.remove('active');
  const mobileSharedBtn = document.getElementById('mobile-shared-btn');
  if (mobileSharedBtn) mobileSharedBtn.classList.remove('active');

  // Marque les boutons période
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
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
document.getElementById('dashboard-btn').addEventListener('click', () => loadDashboard('7d'));

// Bouton pages partagées dans la sidebar
document.getElementById('shared-pages-btn').addEventListener('click', () => loadSharedPages());

// Périodes dans le dashboard
document.querySelectorAll('.period-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const period = btn.dataset.period;
    if (!period) return;
    loadDashboard(period);
  });
});

// ── Profile ──────────────────────────────────────────────────────────
// Charge et affiche le profil
async function loadProfile() {
  try {
    const data = await api.profile.me();
    ui.renderProfile(data.user);
    ui.showProfile();

    state.currentView = 'profile';
    state.currentWorkspaceId = null;
    state.currentWorkspaceRole = null;
    state.currentPageId = null;
    state.currentPageSource = null;
    state.currentPagePermission = null;
    state.pageShares = [];
    resetCommentsState();
    saveViewState();
    // Marquer le user-info comme actif
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.classList.add('active');
    // Désélectionne le workspace actif dans la sidebar
    document.querySelectorAll('.workspace-item')
      .forEach(el => el.classList.remove('active'));
    // Enlever l'active du dashboard
    const dashboardBtn = document.getElementById('dashboard-btn');
    if (dashboardBtn) dashboardBtn.classList.remove('active');
    const sharedBtn = document.getElementById('shared-pages-btn');
    if (sharedBtn) sharedBtn.classList.remove('active');
    const mobileSharedBtn = document.getElementById('mobile-shared-btn');
    if (mobileSharedBtn) mobileSharedBtn.classList.remove('active');

    if (document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
    }
    return true;
  } catch (err) {
    ui.showNotification('Erreur lors du chargement du profil.');
    return false;
  }
}

// Lien vers le profil depuis le user-info de la sidebar
document.getElementById('user-info').addEventListener('click', loadProfile);

const profileLogoutBtn = document.getElementById('profile-logout-btn');
if (profileLogoutBtn) {
  profileLogoutBtn.addEventListener('click', () => {
    ui.openModal('logout-modal');
  });
}

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
const mobileSharedBtn = document.getElementById('mobile-shared-btn');
const mobileWorkspacesBtn = document.getElementById('mobile-workspaces-btn');
const mobileProfileBtn = document.getElementById('mobile-profile-btn');

if (mobileDashboardBtn) {
  mobileDashboardBtn.addEventListener('click', async () => {
    await loadDashboard();
    mobileDashboardBtn.classList.add('active');
    mobileSharedBtn?.classList.remove('active');
    mobileWorkspacesBtn?.classList.remove('active');
    mobileProfileBtn?.classList.remove('active');
  });
}

if (mobileSharedBtn) {
  mobileSharedBtn.addEventListener('click', async () => {
    await loadSharedPages();
    mobileSharedBtn.classList.add('active');
    mobileDashboardBtn?.classList.remove('active');
    mobileWorkspacesBtn?.classList.remove('active');
    mobileProfileBtn?.classList.remove('active');
  });
}

if (mobileWorkspacesBtn) {
  const workspaceDropdown = document.getElementById('mobile-workspace-dropdown');
  const workspaceList = document.getElementById('mobile-workspace-list');

  mobileWorkspacesBtn.addEventListener('click', () => {
    if (!workspaceDropdown || !workspaceList) return;

    // Mise à jour du contenu à chaque ouverture
    workspaceList.innerHTML = '';
    if (!state.workspaces || state.workspaces.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Aucun workspace';
      li.className = 'mobile-workspace-item';
      li.style.opacity = '0.65';
      workspaceList.appendChild(li);
    } else {
      state.workspaces.forEach((ws) => {
        const li = document.createElement('li');
        li.textContent = ws.name;
        li.className = 'mobile-workspace-item';
        li.dataset.workspaceId = ws.id;

        if (state.currentWorkspaceId === ws.id) {
          li.classList.add('active');
        }

        li.addEventListener('click', async () => {
          await selectWorkspace(ws.id);
          if (workspaceDropdown) {
            workspaceDropdown.classList.add('hidden');
          }
        });

        workspaceList.appendChild(li);
      });
    }

    workspaceDropdown.classList.toggle('hidden');
    mobileWorkspacesBtn.classList.add('active');
    mobileDashboardBtn?.classList.remove('active');
    mobileSharedBtn?.classList.remove('active');
    mobileProfileBtn?.classList.remove('active');
  });

  document.addEventListener('click', (event) => {
    if (!workspaceDropdown || !mobileWorkspacesBtn) return;
    const inside = event.target.closest('#mobile-workspace-dropdown') || event.target.closest('#mobile-workspaces-btn');
    if (!inside) {
      workspaceDropdown.classList.add('hidden');
    }
  });
}

if (mobileProfileBtn) {
  mobileProfileBtn.addEventListener('click', async () => {
    await loadProfile();
    mobileProfileBtn.classList.add('active');
    mobileDashboardBtn?.classList.remove('active');
    mobileSharedBtn?.classList.remove('active');
    mobileWorkspacesBtn?.classList.remove('active');
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
initAuthEnhancements();
