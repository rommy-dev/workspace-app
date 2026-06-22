const ui = {

  // ── Helpers ────────────────────────────────────────────────────────
  show(id)   { document.getElementById(id).classList.remove('hidden'); },
  hide(id)   { document.getElementById(id).classList.add('hidden'); },
  text(id, t){ document.getElementById(id).textContent = t; },

  // Tronque un texte et ajoute des "..." s'il dépasse la longueur max
  truncateText(text, maxLength = 20) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },
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

  setWorkspaceActions({ canDeleteWorkspace, canEditPages, canDeletePage = canEditPages }) {
    const deleteBtn = document.getElementById('delete-workspace-btn');
    if (deleteBtn) deleteBtn.classList.toggle('hidden', !canDeleteWorkspace);

    const newPageBtn   = document.getElementById('new-page-btn');
    const savePageBtn  = document.getElementById('save-page-btn');
    const deletePageBtn= document.getElementById('delete-page-btn');
    const titleInput   = document.getElementById('page-title-input');
    const contentInput = document.getElementById('page-content-input');

    [newPageBtn, savePageBtn, deletePageBtn].forEach(btn => {
      if (!btn) return;
      const disable = btn === deletePageBtn ? !canDeletePage : !canEditPages;
      btn.disabled = disable;
      btn.setAttribute('aria-disabled', disable.toString());
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
      avatarImg.src = '';
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

    const existingBtn = document.getElementById('show-all-workspaces-btn');
    if (existingBtn) existingBtn.remove();

    if (workspaces.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun workspace</li>';
      this.refreshIcons();
      return;
    }

    const SIDEBAR_LIMIT = 10;
    workspaces.slice(0, SIDEBAR_LIMIT).forEach(ws => {
      const li = document.createElement('li');
      li.className = 'workspace-item' + (parseInt(ws.id) === currentId ? ' active' : '');
      li.title = ws.name;
      const initials = ws.name
        ? ws.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '?';

      const initialsEl = document.createElement('span');
      initialsEl.className = 'ws-initials';
      initialsEl.textContent = initials || '?';

      const nameEl = document.createElement('span');
      nameEl.className = 'ws-name';
      nameEl.textContent = this.truncateText(ws.name, 25);

      li.appendChild(initialsEl);
      li.appendChild(nameEl);
      li.dataset.id = ws.id;
      list.appendChild(li);
    });

    if (workspaces.length > SIDEBAR_LIMIT) {
      const btn = document.createElement('button');
      btn.id = 'show-all-workspaces-btn';
      btn.type = 'button';
      btn.className = 'show-all-workspaces-btn';
      btn.textContent = 'Afficher tous les workspaces';
      list.insertAdjacentElement('afterend', btn);
    }

    this.refreshIcons();
  },

  renderAllWorkspacesModal(workspaces, currentId, page, pageSize) {
    const list = document.getElementById('all-workspaces-list');
    const indicator = document.getElementById('all-workspaces-page-indicator');
    const prevBtn = document.getElementById('all-workspaces-prev');
    const nextBtn = document.getElementById('all-workspaces-next');
    if (!list || !indicator || !prevBtn || !nextBtn) return page;

    const totalPages = Math.max(1, Math.ceil(workspaces.length / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const pageItems = workspaces.slice(start, start + pageSize);

    list.innerHTML = '';

    if (pageItems.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun workspace</li>';
    } else {
      pageItems.forEach(ws => {
        const li = document.createElement('li');
        li.className = 'all-workspaces-item' + (parseInt(ws.id) === currentId ? ' active' : '');
        li.title = ws.name;
        li.dataset.id = ws.id;

        const initials = ws.name
          ? ws.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
          : '?';

        const initialsEl = document.createElement('span');
        initialsEl.className = 'all-workspaces-initials';
        initialsEl.textContent = initials || '?';

        const nameEl = document.createElement('span');
        nameEl.className = 'all-workspaces-name';
        nameEl.textContent = ws.name;

        li.appendChild(initialsEl);
        li.appendChild(nameEl);
        list.appendChild(li);
      });
    }

    indicator.textContent = `Page ${safePage} / ${totalPages}`;
    prevBtn.disabled = safePage <= 1;
    nextBtn.disabled = safePage >= totalPages;

    this.refreshIcons();
    return safePage;
  },

  // ── Workspace view ───────────────────────────────────────────────────
  showWorkspaceView(workspace, pages) {
    this.hide('empty-state');
    this.hide('page-view');
    this.hide('shared-pages-view');
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
      
      if (member.avatar_url) {
        const avatarImg = document.createElement('img');
        avatarImg.src = member.avatar_url.startsWith('http') 
          ? member.avatar_url 
          : '/' + member.avatar_url;
        avatarImg.alt = `Avatar de ${member.name}`;
        avatarImg.dataset.avatarUrl = avatarImg.src;
        avatarImg.className = 'member-avatar-img';
        
        // Fallback if image fails to load
        avatarImg.onerror = function() {
          this.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.className = 'member-avatar-fallback';
          fallback.textContent = member.name.charAt(0).toUpperCase();
          avatar.appendChild(fallback);
        };
        
        avatar.appendChild(avatarImg);
      } else {
        const fallback = document.createElement('div');
        fallback.className = 'member-avatar-fallback';
        fallback.textContent = member.name.charAt(0).toUpperCase();
        avatar.appendChild(fallback);
      }
      
      // Make avatar clickable to open modal if there's an image
      if (member.avatar_url) {
        avatar.style.cursor = 'pointer';
        avatar.dataset.avatarUrl = member.avatar_url.startsWith('http') 
          ? member.avatar_url 
          : '/' + member.avatar_url;
        avatar.setAttribute('title', `Agrandir l'avatar de ${member.name}`);
        avatar.setAttribute('role', 'button');
        avatar.setAttribute('aria-label', `Agrandir l'avatar de ${member.name}`);
      }

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

      if (isSelf && !isOwner) {
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
    this.hide('shared-pages-view');
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
    this.hide('shared-pages-view');
    this.hide('dashboard-view');
    this.hide('profile-view');
  },

  // ── Dashboard view ─────────────────────────────────────────────────────────
  showDashboard() {
    this.hide('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('shared-pages-view');
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

    const trendMap = {
      workspaces: stats.workspaces_trend || 0,
      pages: stats.pages_trend || 0,
      comments: stats.comments_trend || 0,
      collaborators: stats.collaborators_trend || 0,
    };
    this.text('stat-workspaces-trend', trendMap.workspaces > 0 ? `↑ ${trendMap.workspaces}%` : (trendMap.workspaces < 0 ? `↓ ${Math.abs(trendMap.workspaces)}%` : '—'));
    this.text('stat-pages-trend', trendMap.pages > 0 ? `↑ ${trendMap.pages}%` : (trendMap.pages < 0 ? `↓ ${Math.abs(trendMap.pages)}%` : '—'));
    this.text('stat-comments-trend', trendMap.comments > 0 ? `↑ ${trendMap.comments}%` : (trendMap.comments < 0 ? `↓ ${Math.abs(trendMap.comments)}%` : '—'));
    this.text('stat-collaborators-trend', trendMap.collaborators > 0 ? `↑ ${trendMap.collaborators}%` : (trendMap.collaborators < 0 ? `↓ ${Math.abs(trendMap.collaborators)}%` : '—'));

    // Activité personnelle
    this.text('personal-pages', stats.user_pages_created || 0);
    this.text('personal-comments', stats.user_comments || 0);
    this.text('personal-response-time', stats.average_response_time ? `${stats.average_response_time} min` : '—');

    // Top workspaces
    const topWorkspacesEl = document.getElementById('top-workspaces-list');
    topWorkspacesEl.innerHTML = '';
    const top = [...workspaces]
      .sort((a,b) => ((b.pages_count || 0) + (b.comments_count || 0)) - ((a.pages_count || 0) + (a.comments_count || 0)))
      .slice(0, 3);

    if (top.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Aucun workspace actif pour le moment';
      topWorkspacesEl.appendChild(li);
    } else {
      top.forEach(ws => {
        const li = document.createElement('li');
        li.textContent = `${ws.name} (${(ws.pages_count||0)} pages, ${(ws.comments_count||0)} comm.)`;
        li.className = 'top-workspace-item';
        li.style.cursor = 'pointer';
        li.dataset.workspaceId = ws.id;

        li.addEventListener('click', async () => {
          if (typeof window.selectWorkspace === 'function') {
            await window.selectWorkspace(ws.id);
          }
        });

        topWorkspacesEl.appendChild(li);
      });
    }

    // Graphique activité
    const chartInner = document.getElementById('dashboard-chart-inner');
    chartInner.innerHTML = '';

    const timeline = stats.timeline || [];
    if (timeline.length === 0) {
      chartInner.innerHTML = '<p class="empty-hint">Aucune donnée de timeline disponible.</p>';
    } else {
      const maxActivity = Math.max(...timeline.map(row => row.activity || 0), 1);

      timeline.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'chart-row';

        const label = document.createElement('span');
        label.className = 'chart-label';
        label.textContent = row.date;

        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar';

        const pagesFill = document.createElement('div');
        pagesFill.className = 'chart-bar-fill pages';
        pagesFill.style.width = `${Math.round(((row.pages||0)/maxActivity)*100)}%`;

        const commentsFill = document.createElement('div');
        commentsFill.className = 'chart-bar-fill comments';
        commentsFill.style.width = `${Math.round(((row.comments||0)/maxActivity)*100)}%`;

        barContainer.appendChild(pagesFill);
        barContainer.appendChild(commentsFill);

        const value = document.createElement('span');
        value.className = 'chart-value';
        value.textContent = `${row.pages || 0}p / ${row.comments || 0}c`;

        rowEl.appendChild(label);
        rowEl.appendChild(barContainer);
        rowEl.appendChild(value);

        chartInner.appendChild(rowEl);
      });
    }

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
    this.hide('shared-pages-view');
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
    const profileAvatar = document.querySelector('.profile-avatar');
    
    if (user.avatar_url) {
      // Support both local paths (avatars/...) and external URLs
      const src = user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : '/' + user.avatar_url;
      avatarImg.src = src;
      avatarImg.dataset.avatarUrl = src;
      avatarImg.style.display = 'block';
      avatarFallback.classList.remove('active');
      if (profileAvatar) profileAvatar.classList.add('has-avatar');
    } else {
      avatarImg.src = '';
      avatarImg.removeAttribute('data-avatar-url');
      avatarImg.style.display = 'none';
      avatarFallback.classList.add('active');
      avatarFallback.textContent = user.name.charAt(0).toUpperCase();
      if (profileAvatar) profileAvatar.classList.remove('has-avatar');
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

  // ── Pages partagées ─────────────────────────────────────────────────
  showSharedPagesView() {
    this.hide('empty-state');
    this.hide('workspace-view');
    this.hide('page-view');
    this.hide('dashboard-view');
    this.hide('profile-view');
    this.show('shared-pages-view');
    const sharedView = document.getElementById('shared-pages-view');
    if (sharedView) {
      sharedView.classList.remove('fade-in-quick');
      void sharedView.offsetWidth;
      sharedView.classList.add('fade-in-quick');
    }
  },

  renderSharedPageList(pages) {
    const list = document.getElementById('shared-page-list');
    if (!list) return;
    list.innerHTML = '';

    if (!pages || pages.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucune page partagée</li>';
      return;
    }

    pages.forEach(page => {
      const li = document.createElement('li');
      li.className = 'shared-page-item';
      li.dataset.pageId = page.page_id;
      li.dataset.workspaceId = page.workspace_id;
      li.dataset.permission = page.permission;

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'shared-page-title';
      title.textContent = page.title || 'Sans titre';

      const meta = document.createElement('div');
      meta.className = 'shared-page-meta';
      const owner = page.owner_name ? ` · ${page.owner_name}` : '';
      meta.textContent = `${page.workspace_name}${owner}`;

      left.appendChild(title);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'shared-page-actions';

      const badge = document.createElement('span');
      badge.className = `permission-badge ${page.permission}`;
      badge.textContent = page.permission === 'edit' ? 'Édition' : 'Lecture';

      const updated = document.createElement('div');
      updated.className = 'shared-page-meta';
      const date = page.updated_at ? new Date(page.updated_at) : null;
      updated.textContent = date
        ? `Maj ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
        : '';

      right.appendChild(badge);
      if (updated.textContent) right.appendChild(updated);

      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
  },

  // ── Partages sur une page ─────────────────────────────────────────
  renderShareList(shares) {
    const list = document.getElementById('share-list');
    if (!list) return;
    list.innerHTML = '';

    if (!shares || shares.length === 0) {
      list.innerHTML = '<li class="empty-hint">Aucun partage pour l\'instant</li>';
      return;
    }

    shares.forEach(share => {
      const li = document.createElement('li');
      li.className = 'share-item';
      li.dataset.userId = share.user_id;

      const details = document.createElement('div');
      details.className = 'share-item-details';

      const name = document.createElement('div');
      name.className = 'share-item-name';
      name.textContent = share.name || 'Utilisateur';

      const email = document.createElement('div');
      email.className = 'share-item-email';
      email.textContent = share.email;

      details.appendChild(name);
      details.appendChild(email);

      const actions = document.createElement('div');
      actions.className = 'share-item-actions';

      const select = document.createElement('select');
      select.dataset.action = 'permission';
      select.dataset.userId = share.user_id;
      const readOpt = document.createElement('option');
      readOpt.value = 'read';
      readOpt.textContent = 'Lecture';
      const editOpt = document.createElement('option');
      editOpt.value = 'edit';
      editOpt.textContent = 'Édition';
      select.appendChild(readOpt);
      select.appendChild(editOpt);
      select.value = share.permission;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-danger';
      removeBtn.dataset.action = 'remove';
      removeBtn.dataset.userId = share.user_id;
      removeBtn.innerHTML = '<i data-lucide="user-minus" class="icon"></i> Retirer';

      actions.appendChild(select);
      actions.appendChild(removeBtn);

      li.appendChild(details);
      li.appendChild(actions);
      list.appendChild(li);
    });

    this.refreshIcons();
  },

  setShareTotal(count) {
    const el = document.getElementById('share-total');
    if (el) el.textContent = String(count ?? 0);
  },

  setCommentsAvailable(canComment) {
    const container = document.getElementById('comments-container');
    if (container) container.classList.toggle('hidden', !canComment);
  },

  setShareButtonVisible(show) {
    const btn = document.getElementById('share-page-btn');
    if (btn) btn.classList.toggle('hidden', !show);
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

  openAvatarModal(avatarUrl) {
    const modal = document.getElementById('avatar-modal');
    const img = document.getElementById('avatar-modal-image');
    if (!modal || !img) return;

    img.src = avatarUrl;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  },

  closeAvatarModal() {
    const modal = document.getElementById('avatar-modal');
    const img = document.getElementById('avatar-modal-image');
    if (!modal || !img) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    img.src = '';
    document.body.classList.remove('modal-open');
  },
};
