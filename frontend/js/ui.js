const ui = {

  // ── Helpers ────────────────────────────────────────────────────────
  show(id)   { document.getElementById(id).classList.remove('hidden'); },
  hide(id)   { document.getElementById(id).classList.add('hidden'); },
  text(id, t){ document.getElementById(id).textContent = t; },
  val(id)    { return document.getElementById(id).value.trim(); },
  setVal(id, v){ document.getElementById(id).value = v; },
  clearVal(id) { document.getElementById(id).value = ''; },

  showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) el.textContent = message;
  },

  clearError(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.textContent = '';
  },

  // ── Auth ────────────────────────────────────────────────────────────
  showAuthScreen() {
    this.show('auth-screen');
    this.hide('app-screen');
  },

  showAppScreen(user) {
    this.hide('auth-screen');
    this.show('app-screen');
    this.text('user-name', user.name);
  },

  // ── Sidebar ─────────────────────────────────────────────────────────
  // Reçoit le tableau de workspaces et l'id courant,
  // reconstruit toute la liste — approche simple et prévisible
  renderWorkspaceList(workspaces, currentId) {
    const list = document.getElementById('workspace-list');
    list.innerHTML = '';

    if (workspaces.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun workspace</li>';
      return;
    }

    workspaces.forEach(ws => {
      const li = document.createElement('li');
      li.className = 'workspace-item' + (ws.id === currentId ? ' active' : '');
      li.textContent = ws.name;
      li.dataset.id = ws.id;
      list.appendChild(li);
    });
  },

  // ── Workspace view ───────────────────────────────────────────────────
  showWorkspaceView(workspace, pages) {
    this.hide('empty-state');
    this.hide('page-view');
    this.show('workspace-view');
    this.text('workspace-title', workspace.name);
    this.renderPageList(pages);
  },

  renderPageList(pages) {
    const list = document.getElementById('page-list');
    list.innerHTML = '';

    if (pages.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucune page</li>';
      return;
    }

    pages.forEach(page => {
      const li = document.createElement('li');
      li.className = 'page-item';
      li.textContent = page.title;
      li.dataset.id = page.id;
      list.appendChild(li);
    });
  },

  // ── Page view ────────────────────────────────────────────────────────
  showPageView(page) {
    this.hide('workspace-view');
    this.show('page-view');
    this.setVal('page-title-input', page.title);
    this.setVal('page-content-input', page.content || '');
  },

  showEmptyState() {
    this.show('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
  },
};
