// Source de vérité unique de l'app.
// Jamais modifié directement depuis ui.js — seulement depuis app.js.
const state = {
  currentUser:        null,  // { id, name, email }
  workspaces:         [],    // tableau complet
  currentWorkspaceId: null,
  pages:              [],    // pages du workspace courant
  currentPageId:      null,
};
