// URL absolue de vérification : celle du serveur (origine publique canonique) telle quelle ;
// repli sur l'origine du navigateur seulement pour un ancien chemin relatif (documents déjà émis).
export function urlVerification(verif, cheminAncien) {
  const url = /^https?:\/\//.test(verif || "") ? verif : `${typeof window !== "undefined" ? window.location.origin : ""}${verif || cheminAncien}`;
  return { url, hote: url.replace(/^https?:\/\//, "").split("/")[0] };
}
