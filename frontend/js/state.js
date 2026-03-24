// Source de vérité unique de l'app.
// Jamais modifié directement depuis ui.js — seulement depuis app.js.
const state = {
  currentUser:        null,  // { id, name, email }
  workspaces:         [],    // tableau complet
  currentWorkspaceId: null,
  currentWorkspaceRole: null, // owner | admin | editor | viewer
  members:            [],    // membres du workspace courant
  pages:              [],    // pages du workspace courant
  currentPageId:      null,
  comments:           [],    // commentaires de la page courante
  commentsOpen:       false,
  editingCommentId:   null,
};
