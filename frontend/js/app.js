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
    ui.showAppScreen(data.user);
    await loadWorkspaces();
  } catch (err) {
    ui.showError('login-error', err.message);
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
    ui.showAppScreen(data.user);
    await loadWorkspaces();
  } catch (err) {
    // Affiche les erreurs de validation champ par champ si disponibles
    const msg = err.errors
      ? Object.values(err.errors).join(' ')
      : err.message;
    ui.showError('register-error', msg);
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api.auth.logout();
  state.currentUser        = null;
  state.workspaces         = [];
  state.currentWorkspaceId = null;
  state.pages              = [];
  state.currentPageId      = null;
  ui.showAuthScreen();
});

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
async function loadWorkspaces() {
  const data = await api.workspaces.list();
  state.workspaces = data.workspaces;
  ui.renderWorkspaceList(state.workspaces, state.currentWorkspaceId);
}

async function selectWorkspace(id) {
  state.currentWorkspaceId = id;
  state.currentPageId      = null;

  const data = await api.pages.list(id);
  state.pages = data.pages;

  const workspace = state.workspaces.find(w => w.id === id);
  ui.renderWorkspaceList(state.workspaces, id);
  ui.showWorkspaceView(workspace, state.pages);
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
  state.pages              = [];
  await loadWorkspaces();
  ui.showEmptyState();
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

// ── Démarrage ────────────────────────────────────────────────────────
init();
