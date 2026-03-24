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

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  setWorkspaceRole(role) {
    const el = document.getElementById('current-role-badge');
    if (!el) return;
    const labels = {
      owner:  'Propriétaire',
      admin:  'Admin',
      editor: 'Éditeur',
      viewer: 'Lecteur',
    };
    if (!role) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = labels[role] || role;
    // Ajoute la classe de couleur correspondante au rôle
    el.className = `role-badge ${role}`;
    el.classList.remove('hidden');
  },

  toggleInviteForm(show) {
    const form = document.getElementById('invite-form');
    if (!form) return;
    form.classList.toggle('hidden', !show);
  },

  setWorkspaceActions({ canDeleteWorkspace, canEditPages }) {
    const deleteBtn = document.getElementById('delete-workspace-btn');
    if (deleteBtn) deleteBtn.classList.toggle('hidden', !canDeleteWorkspace);

    const newPageBtn   = document.getElementById('new-page-btn');
    const savePageBtn  = document.getElementById('save-page-btn');
    const deletePageBtn= document.getElementById('delete-page-btn');
    const titleInput   = document.getElementById('page-title-input');
    const contentInput = document.getElementById('page-content-input');

    [newPageBtn, savePageBtn, deletePageBtn].forEach(btn => {
      if (!btn) return;
      btn.disabled = !canEditPages;
      btn.setAttribute('aria-disabled', (!canEditPages).toString());
    });

    if (titleInput)  titleInput.readOnly  = !canEditPages;
    if (contentInput) contentInput.readOnly = !canEditPages;
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
      this.refreshIcons();
      return;
    }

    workspaces.forEach(ws => {
      const li = document.createElement('li');
      li.className = 'workspace-item' + (ws.id === currentId ? ' active' : '');
      li.title = ws.name;
      const initials = ws.name
        ? ws.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '?';

      const initialsEl = document.createElement('span');
      initialsEl.className = 'ws-initials';
      initialsEl.textContent = initials || '?';

      const nameEl = document.createElement('span');
      nameEl.className = 'ws-name';
      nameEl.textContent = ws.name;

      li.appendChild(initialsEl);
      li.appendChild(nameEl);
      li.dataset.id = ws.id;
      list.appendChild(li);
    });

    this.refreshIcons();
  },

  // ── Workspace view ───────────────────────────────────────────────────
  showWorkspaceView(workspace, pages) {
    this.hide('empty-state');
    this.hide('page-view');
    this.hide('dashboard-view');
    this.show('workspace-view');
    this.text('workspace-title', workspace.name);
    this.renderPageList(pages);
  },

  renderPageList(pages) {
    const list = document.getElementById('page-list');
    list.innerHTML = '';

    if (pages.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucune page</li>';
      this.refreshIcons();
      return;
    }

    pages.forEach(page => {
      const li = document.createElement('li');
      li.className = 'page-item';
      li.textContent = page.title;
      li.dataset.id = page.id;
      list.appendChild(li);
    });

    this.refreshIcons();
  },

  renderMemberList(members, currentUserId, canManageMembers) {
    const list = document.getElementById('member-list');
    if (!list) return;
    list.innerHTML = '';

    if (members.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun membre</li>';
      return;
    }

    const roleLabels = {
      owner:  'Propriétaire',
      admin:  'Admin',
      editor: 'Éditeur',
      viewer: 'Lecteur',
    };

    members.forEach(member => {
      const li = document.createElement('li');
      li.className = 'member-item';

      const meta = document.createElement('div');
      meta.className = 'member-meta';

      const name = document.createElement('span');
      name.className = 'member-name';
      name.textContent = member.name;

      const email = document.createElement('span');
      email.className = 'member-email';
      email.textContent = member.email;

      const role = document.createElement('span');
      role.className = `member-role role-badge ${member.role}`;
      role.textContent = roleLabels[member.role] || member.role;

      meta.appendChild(name);
      meta.appendChild(email);
      meta.appendChild(role);

      const actions = document.createElement('div');
      actions.className = 'member-actions';

      const memberId = parseInt(member.user_id);
      const isSelf = memberId === currentUserId;
      const isOwner = member.role === 'owner';

      if (isSelf) {
        const btn = document.createElement('button');
        btn.innerHTML = '<i data-lucide="log-out" class="icon"></i> Quitter';
        btn.dataset.action = 'leave';
        btn.dataset.userId = memberId;
        actions.appendChild(btn);
      } else if (canManageMembers && !isOwner) {
        const btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.innerHTML = '<i data-lucide="user-minus" class="icon"></i> Retirer';
        btn.dataset.action = 'remove';
        btn.dataset.userId = memberId;
        actions.appendChild(btn);
      }

      li.appendChild(meta);
      li.appendChild(actions);
      list.appendChild(li);
    });
  },

  // ── Page view ────────────────────────────────────────────────────────
  showPageView(page) {
    this.hide('workspace-view');
    this.hide('empty-state');
    this.hide('dashboard-view');
    this.show('page-view');
    this.setVal('page-title-input', page.title);
    this.setVal('page-content-input', page.content || '');
    this.refreshIcons();
  },

  showEmptyState() {
    this.show('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('dashboard-view');
  },

  // ── Dashboard view ─────────────────────────────────────────────────────────
  showDashboard() {
    this.hide('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.show('dashboard-view');
  },

  renderDashboard(data) {
    const { stats, workspaces, recent_activity } = data;

    // Stats globales
    this.text('stat-workspaces',    stats.workspaces_count);
    this.text('stat-pages',         stats.pages_count);
    this.text('stat-comments',      stats.comments_count);
    this.text('stat-collaborators', stats.collaborators_count);

    // Workspaces avec barres proportionnelles
    const maxPages   = Math.max(...workspaces.map(w => w.pages_count), 1);
    const container  = document.getElementById('workspace-stats-list');
    container.innerHTML = '';

    workspaces.forEach(ws => {
      const pct = Math.round((ws.pages_count / maxPages) * 100);
      const div = document.createElement('div');
      div.className = 'ws-stat-row';
      div.innerHTML = `
        <div class="ws-stat-header">
          <span class="ws-stat-name">${ws.name}</span>
          <span class="ws-stat-counts">
            ${ws.pages_count} page${ws.pages_count !== 1 ? 's' : ''}
            · ${ws.comments_count} commentaire${ws.comments_count !== 1 ? 's' : ''}
            · ${ws.members_count+1} membre${ws.members_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div class="ws-stat-bar-track">
          <div class="ws-stat-bar-fill" style="width: ${pct}%"></div>
        </div>
      `;
      container.appendChild(div);
    });

    // Activité récente
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = '';

    if (recent_activity.length === 0) {
      feed.innerHTML = '<li class="empty-hint">Aucune activité récente.</li>';
      return;
    }

    recent_activity.forEach(item => {
      const li  = document.createElement('li');
      li.className = 'activity-item';
      const icon = item.type === 'page' ? '📄' : '💬';
      const date = new Date(item.happened_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      li.innerHTML = `
        <span class="activity-icon">${icon}</span>
        <div class="activity-body">
          <span class="activity-desc">${item.description}</span>
          <span class="activity-meta">${item.actor} · ${item.workspace_name} · ${date}</span>
        </div>
      `;
      feed.appendChild(li);
    });
  },
};
