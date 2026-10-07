import { describeHiddenArtwork, getPublicationState } from "./publication-state.js";

const panel = document.createElement("details");
panel.className = "publication-status";
panel.hidden = true;
panel.innerHTML = `<summary aria-label="État de publication"><span data-publication-label role="status" aria-live="polite"></span><span data-publication-warning></span></summary>
  <div class="publication-details"><p data-publication-message></p><ul data-hidden-artworks></ul><p class="publication-help" hidden>Choisissez une photo pour remettre ces œuvres en ligne. Leur fiche reste disponible dans le CMS.</p></div>`;
document.body.append(panel);
const label = panel.querySelector("[data-publication-label]");
const warning = panel.querySelector("[data-publication-warning]");
const message = panel.querySelector("[data-publication-message]");
const list = panel.querySelector("[data-hidden-artworks]");
const help = panel.querySelector(".publication-help");
let busy = false;
let waitingSince = null;
let rendered = "";
let observedRevision = null;
let lastSnapshot = null;
let saveGeneration = 0;

const render = (state) => {
  const signature = JSON.stringify(state);
  if (signature === rendered) return;
  rendered = signature;
  panel.dataset.state = state.state;
  label.textContent = state.label;
  warning.textContent = state.hidden.length ? ` · ${state.hidden.length} œuvre${state.hidden.length > 1 ? "s" : ""} masquée${state.hidden.length > 1 ? "s" : ""}` : "";
  message.textContent = state.message;
  list.replaceChildren(...state.hidden.map((artwork) => {
    const item = document.createElement("li");
    item.textContent = describeHiddenArtwork(artwork);
    return item;
  }));
  list.hidden = !state.hidden.length;
  help.hidden = !state.hidden.length;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000), ...options });
  if (!response.ok) throw new Error("Publication verification unavailable");
  return response.json();
};

const refresh = async () => {
  const user = window.netlifyIdentity?.currentUser();
  panel.hidden = !user;
  if (!user || busy || document.hidden) return;
  busy = true;
  const generation = saveGeneration;
  try {
    // Use the same authenticated, same-origin endpoint as Decap's Git Gateway
    // backend. The editor's token is never stored or sent to another service.
    const [snapshotResult, branchResult] = await Promise.allSettled([
      fetchJson("/admin/publication.json"),
      user.jwt().then((token) => fetchJson("/.netlify/git/github/branches/main", { headers: { Authorization: `Bearer ${token}` } })),
    ]);
    if (generation !== saveGeneration) return;
    const snapshot = snapshotResult.status === "fulfilled" && snapshotResult.value?.version === 1 ? snapshotResult.value : null;
    if (snapshot) lastSnapshot = snapshot;
    const latestRevision = branchResult.status === "fulfilled" ? branchResult.value.commit?.sha : null;
    if (latestRevision && latestRevision !== observedRevision) {
      observedRevision = latestRevision;
      waitingSince = null;
    }
    if (latestRevision && snapshot?.revision !== latestRevision) waitingSince ??= Date.now();
    else waitingSince = null;
    render(getPublicationState({ snapshot: snapshot || { hidden: lastSnapshot?.hidden || [] }, latestRevision, waitingSince }));
  } catch {
    // A failed check must never be presented as successful publication.
    render(getPublicationState({ snapshot: { hidden: lastSnapshot?.hidden || [] } }));
  } finally {
    busy = false;
  }
};

for (const name of ["postSave", "postPublish", "postUnpublish"]) {
  window.CMS?.registerEventListener({ name, handler: () => {
    saveGeneration++;
    waitingSince = Date.now();
    render({ state: "pending", label: "Mise à jour en cours", message: "Vos modifications sont enregistrées. Le site se met à jour.", hidden: lastSnapshot?.hidden || [] });
    // Let the Git Gateway complete the save before reading the branch head.
    setTimeout(refresh, 1000);
  } });
}
window.netlifyIdentity?.on("init", refresh);
window.netlifyIdentity?.on("login", refresh);
window.netlifyIdentity?.on("logout", () => { panel.hidden = true; });
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
setInterval(refresh, 30000);
refresh();
