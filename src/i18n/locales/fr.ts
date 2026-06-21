import type { TranslationSchema } from './en';

export const fr: TranslationSchema = {
  app: {
    name: 'CreaticTV',
    booting: 'Démarrage…',
  },
  disclaimer: {
    title: 'Avant de commencer',
    body: "CreaticTV est uniquement un lecteur multimédia. Aucune chaîne, playlist ou flux n'est fourni avec l'application. Vous connectez votre propre fournisseur avec des identifiants que vous possédez déjà. Vos identifiants sont chiffrés et stockés sur cet appareil, et ne sont transmis qu'à votre fournisseur.",
    accept: "J'ai compris",
  },
  onboarding: {
    addProvider: 'Ajouter un fournisseur',
    xtream: 'Xtream Codes',
    m3u: 'Playlist M3U',
  },
  socle: {
    title: 'Socle prêt',
    body: 'La couche fournisseur et la base de données locale sont en place. Les écrans arrivent ensuite.',
  },
};
