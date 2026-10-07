export const getPublicationState = ({ snapshot, latestRevision, waitingSince = null, now = Date.now() }) => {
  const hidden = Array.isArray(snapshot?.hidden) ? snapshot.hidden : [];
  const known = typeof latestRevision === "string" && !!latestRevision &&
    typeof snapshot?.revision === "string" && !!snapshot.revision;
  if (!known) {
    return { state: "unknown", label: "Statut indisponible", message: "La publication ne peut pas être vérifiée pour le moment.", hidden };
  }
  if (snapshot.revision === latestRevision) {
    return { state: "current", label: "À jour", message: "Vos dernières modifications sont publiées sur le site.", hidden };
  }
  if (waitingSince !== null && now - waitingSince >= 8 * 60 * 1000) {
    return { state: "delayed", label: "Publication à vérifier", message: "La mise à jour prend plus longtemps que prévu. Vos modifications sont enregistrées, mais leur publication reste à vérifier.", hidden };
  }
  return { state: "pending", label: "Publication en attente", message: "Vos modifications sont enregistrées. La mise à jour se lance après trois minutes sans nouveau changement, puis le site se met à jour.", hidden };
};

export const describeHiddenArtwork = (artwork) => `${artwork.title} — ${
  artwork.reason === "no-image" ? "photo à ajouter" : "photo à remplacer ou à sélectionner à nouveau"
}`;
