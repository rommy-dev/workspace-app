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

  // ── Notification Popup ─────────────────────────────────────
  showNotification(message, duration = 3000) {
    const popup = document.getElementById('notification-popup');
    const messageEl = document.getElementById('notification-message');
    
    if (!popup || !messageEl) return;
    
    messageEl.textContent = message;
    popup.classList.remove('hidden');
    
    // Force reflow pour activer la transition
    popup.offsetHeight;
    
    popup.classList.add('show');
    this.refreshIcons();
    
    // Masquer automatiquement après la durée spécifiée
    setTimeout(() => {
      this.hideNotification();
    }, duration);
  },
  
  hideNotification() {
    const popup = document.getElementById('notification-popup');
    if (!popup) return;
    
    popup.classList.remove('show');
    
    // Attendre la fin de la transition avant de cacher complètement
    setTimeout(() => {
      popup.classList.add('hidden');
    }, 300);
  },

  // ── Modal Management ───────────────────────────────────────
  openModal(modalId, inputId, errorId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Retirer les classes d'animation précédentes
    modal.classList.remove('fade-out');
    const modalInner = modal.querySelector('.modal');
    if (modalInner) modalInner.classList.remove('closing');
    
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    if (errorId) this.clearError(errorId);
    if (inputId) {
      this.setVal(inputId, '');
      const input = document.getElementById(inputId);
      if (input) setTimeout(() => input.focus(), 0);
    }

    this.refreshIcons();
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Ajouter l'animation fade-out
    modal.classList.add('fade-out');
    
    // Attendre la fin de l'animation avant de cacher le modal
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('fade-out');
      modal.setAttribute('aria-hidden', 'true');
    }, 300); // Durée de l'animation fade-out
  },

  // ── Modal State Management ───────────────────────────────────
  updateModalState(modalIds) {
    const anyOpen = modalIds.some(id => this.isModalOpen(id));
    document.body.classList.toggle('modal-open', anyOpen);
  },

  isModalOpen(id) {
    const modal = document.getElementById(id);
    return modal && !modal.classList.contains('hidden');
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
    
    // Gérer l'avatar dans la sidebar
    const avatarImg = document.getElementById('user-avatar-img');
    const avatarFallback = document.getElementById('user-avatar-fallback');
    
    if (user.avatar_url) {
      // Support both local paths (avatars/...) and external URLs
      const src = user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : '/' + user.avatar_url;
      avatarImg.src = src;
      avatarImg.style.display = 'block';
      avatarFallback.classList.remove('active');
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.classList.add('active');
      avatarFallback.textContent = user.name.charAt(0).toUpperCase();
    }
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
    this.hide('profile-view');
    this.show('workspace-view');
    // Ajouter l'animation fade-in
    const workspaceView = document.getElementById('workspace-view');
    if (workspaceView) {
      workspaceView.classList.remove('fade-in-quick');
      void workspaceView.offsetWidth; // Force reflow
      workspaceView.classList.add('fade-in-quick');
    }
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
      list.innerHTML = '<div class="empty-hint">Aucun membre</div>';
      return;
    }

    const roleLabels = {
      owner:  'Propriétaire',
      admin:  'Admin',
      editor: 'Éditeur',
      viewer: 'Lecteur',
    };

    members.forEach(member => {
      const card = document.createElement('div');
      card.className = 'member-card';

      const memberInfo = document.createElement('div');
      memberInfo.className = 'member-info';

      const avatar = document.createElement('div');
      avatar.className = 'member-avatar';
      avatar.textContent = member.name.charAt(0).toUpperCase();

      const details = document.createElement('div');
      details.className = 'member-details';

      const name = document.createElement('div');
      name.className = 'member-name';
      name.textContent = member.name;

      const email = document.createElement('div');
      email.className = 'member-email';
      email.textContent = member.email;

      const role = document.createElement('span');
      role.className = `member-role role-badge ${member.role}`;
      role.textContent = roleLabels[member.role] || member.role;

      details.appendChild(name);
      details.appendChild(email);
      details.appendChild(role);

      memberInfo.appendChild(avatar);
      memberInfo.appendChild(details);

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

      card.appendChild(memberInfo);
      card.appendChild(actions);
      list.appendChild(card);
    });
  },

  setCommentsCount(count) {
    const el = document.getElementById('comments-count');
    if (!el) return;
    el.textContent = String(count ?? 0);
  },

  toggleCommentsPanel(show) {
    const panel = document.getElementById('comments-panel');
    if (panel) panel.classList.toggle('hidden', !show);

    const btn = document.getElementById('comments-btn');
    if (btn) {
      btn.classList.toggle('is-open', show);
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
    }
  },

  renderComments(comments, currentUserId, canDeleteAny) {
    const list = document.getElementById('comments-list');
    if (!list) return;
    list.innerHTML = '';

    if (!comments || comments.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun commentaire</li>';
      return;
    }

    const maxWords = 10;

    comments.forEach(comment => {
      const li = document.createElement('li');
      li.className = 'comment-item';
      li.dataset.id = comment.id;

      const meta = document.createElement('div');
      meta.className = 'comment-meta';

      const author = document.createElement('span');
      author.className = 'comment-author';
      author.textContent = comment.author_name || 'Utilisateur';

      const date = document.createElement('span');
      const createdAt = comment.created_at ? new Date(comment.created_at) : null;
      date.textContent = createdAt
        ? createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';

      meta.appendChild(author);
      meta.appendChild(date);

      const body = document.createElement('div');
      body.className = 'comment-body';
      const content = (comment.content || '').trim();
      const words = content.length ? content.split(/\s+/) : [];
      const isTruncated = words.length > maxWords;
      const shortText = isTruncated
        ? words.slice(0, maxWords).join(' ') + '…'
        : content;

      body.textContent = shortText;
      if (isTruncated) {
        body.dataset.full = content;
        body.dataset.short = shortText;
        body.dataset.expanded = 'false';
      }

      const toggle = document.createElement('button');
      toggle.className = 'comment-toggle';
      toggle.dataset.action = 'toggle';
      toggle.dataset.id = comment.id;
      toggle.type = 'button';
      toggle.textContent = isTruncated ? 'Voir plus' : '';

      const actions = document.createElement('div');
      actions.className = 'comment-actions';

      const isAuthor = parseInt(comment.user_id) === currentUserId;
      if (isAuthor) {
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Éditer';
        editBtn.dataset.action = 'edit';
        editBtn.dataset.id = comment.id;
        actions.appendChild(editBtn);
      }

      if (isAuthor || canDeleteAny) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-danger';
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.id = comment.id;
        actions.appendChild(deleteBtn);
      }

      li.appendChild(meta);
      li.appendChild(body);
      if (isTruncated) {
        li.appendChild(toggle);
      }
      li.appendChild(actions);
      list.appendChild(li);
    });
  },

  // ── Page view ────────────────────────────────────────────────────────
  showPageView(page) {
    this.hide('workspace-view');
    this.hide('empty-state');
    this.hide('dashboard-view');
    this.hide('profile-view');
    this.show('page-view');
    // Ajouter l'animation fade-in
    const pageView = document.getElementById('page-view');
    if (pageView) {
      pageView.classList.remove('fade-in-quick');
      void pageView.offsetWidth; // Force reflow
      pageView.classList.add('fade-in-quick');
    }
    this.setVal('page-title-input', page.title);
    this.setVal('page-content-input', page.content || '');
    this.refreshIcons();
  },

  showEmptyState() {
    this.show('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('dashboard-view');
    this.hide('profile-view');
  },

  // ── Dashboard view ─────────────────────────────────────────────────────────
  showDashboard() {
    this.hide('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('profile-view');
    this.show('dashboard-view');
    // Ajouter l'animation fade-in
    const dashboardView = document.getElementById('dashboard-view');
    if (dashboardView) {
      dashboardView.classList.remove('fade-in-quick');
      void dashboardView.offsetWidth; // Force reflow
      dashboardView.classList.add('fade-in-quick');
    }
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

    // Limiter à 10 activités les plus récentes
    const limitedActivities = recent_activity.slice(0, 10);

    limitedActivities.forEach(item => {
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

  // ── Profile view ──────────────────────────────────────────────────────────
  showProfile() {
    this.hide('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('dashboard-view');
    this.show('profile-view');
    // Ajouter l'animation fade-in
    const profileView = document.getElementById('profile-view');
    if (profileView) {
      profileView.classList.remove('fade-in-quick');
      void profileView.offsetWidth; // Force reflow
      profileView.classList.add('fade-in-quick');
    }
  },

  renderProfile(user) {
    // Profil card
    this.text('profile-card-name', user.name);
    this.text('profile-card-email', user.email);

    const createdDate = new Date(user.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    this.text('profile-card-created', `Membre depuis ${createdDate}`);

    // Avatar: display image if URL exists, otherwise show fallback
    const avatarImg = document.getElementById('profile-avatar-img');
    const avatarFallback = document.getElementById('profile-avatar-fallback');
    
    if (user.avatar_url) {
      // Support both local paths (avatars/...) and external URLs
      const src = user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : '/' + user.avatar_url;
      avatarImg.src = src;
      avatarImg.style.display = 'block';
      avatarFallback.classList.remove('active');
    } else {
      avatarImg.style.display = 'none';
      avatarFallback.classList.add('active');
      avatarFallback.textContent = user.name.charAt(0).toUpperCase();
    }

    // Remplir les formulaires
    this.setVal('profile-name-input', user.name);
    this.setVal('profile-email-input', user.email);
    this.clearVal('profile-avatar-file');
    
    // Nettoyer les formulaires de password
    this.clearVal('profile-current-password');
    this.clearVal('profile-new-password');
    this.clearVal('profile-confirm-password');
    
    // Nettoyer les erreurs
    this.clearError('profile-info-error');
    this.clearError('profile-password-error');
  },

  // ── Global Loader ────────────────────────────────────────────────────
  showLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.remove('hidden');
      loader.setAttribute('aria-hidden', 'false');
    }
  },

  hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.add('hidden');
      loader.setAttribute('aria-hidden', 'true');
    }
  },
};
