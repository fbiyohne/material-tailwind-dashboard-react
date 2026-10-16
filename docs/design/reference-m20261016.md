# Référence d'alignement — mission M-20261016 (relevé du design ACTUEL)

Relevé en l'état à ada3e30, sans rien modifier. Tout nouveau comportement s'aligne sur ces valeurs.

## Onglets : `src/barreau/components/Tabs.jsx`
- Conteneur (l.47) : `lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6` si `vertical` (seul Paramètres l.463 l'utilise) ; `items-start` est requis pour un sticky en grille.
- Enveloppe du tablist (l.52) : `border-b border-grisM`, `lg:border-b-0 lg:border-r` en vertical. Aucun sticky.
- Tablist (l.58) : `-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]` ; vertical `lg:-mr-px lg:mb-0 lg:flex-col lg:overflow-visible`. Son propre `overflow-x-auto` rend `overflow-y` calculé à `auto` : le sticky se pose donc sur l'enveloppe, pas sur le tablist.
- Onglet (l.78) : `flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm sm:px-4 font-medium` ; actif `border-or text-navy`, inactif `border-transparent text-gris hover:border-grisM hover:text-encre` ; vertical `lg:border-b-0 lg:border-r-2 lg:pl-0`. Pastille `rounded-full bg-grisL px-1.5 py-0.5 text-xs font-semibold text-gris`.
- Panneau (l.108) : `pt-5 outline-none`, `lg:pt-0` en vertical.
- Imbrication : Paramètres.jsx l.339 (`ariaLabel="Barreau et identité"`, horizontal) dans le panneau du Tabs vertical de l.461 (`ariaLabel="Sections des paramètres"`, 9 onglets). Seul le niveau 1 doit être collant.
- Consommateurs (8) : AssembleeDetail l.173, AvocatDetail l.214, CorpsElectoral l.98, DossierDetail l.280, espace/MesDocuments l.242, Parametres l.339 et 461, ReunionDetail l.188, Timbres l.101. (`src/pages/dashboard/profile.jsx` est un autre template, hors périmètre.)

## En-tête et fonds
- Topbar : `src/barreau/layout/Topbar.jsx:86` `sticky top-0 z-30 flex h-14 ... border-b border-grisM bg-white/95 backdrop-blur` (hauteur 3,5 rem = 56 px).
- BarreauLayout.jsx : l.33 racine `min-h-screen bg-creme` ; **l.42 zone de contenu `min-h-screen bg-white xl:ml-[260px]`** (c'est le fond réel derrière les onglets : blanc) ; main l.49 `mx-auto max-w-container px-4 py-6 md:px-8 md:py-8` (container 1500 px). Aucun overflow sur la chaîne.
- EspaceAvocatLayout.jsx : l.77 racine `min-h-screen bg-creme` (fond derrière les onglets : crème `#FAF8F3`) ; en-tête l.84 `bg-navy-3 text-white`, non collant ; main l.175 identique.
- Sidebar : `Sidebar.jsx:81` voile `z-40`, `:88` panneau `z-50` (mobile, `xl:translate-x-0` en bureau).

## Z-index (échelle observée)
`z-10` thead DataTable et menus internes · `z-20` (libre, prévu pour la barre d'onglets) · `z-30` Topbar · `z-40` voiles de menus (Topbar.jsx:159, ClocheNotifications:82, Sidebar:81) · `z-50` menus déroulants (Topbar.jsx:105/135, Cabinets:245, Conseil:232, Cloche:83, Sidebar:88) · `z-[60]` Modal.jsx:74 · `z-[70]` EditeurDocument:68 · `z-[80]` Toast:37 · `z-[90]` lien d'évitement (layouts l.36/80). Une barre d'onglets en `z-20` reste sous la Topbar et sous tout menu ou modale.

## Ancêtres en overflow des pages Tabs
- Mesuré dans le navigateur (instance 4100) sur Parametres, Timbres et CorpsElectoral : aucun ancêtre du tablist n'a de `overflow` autre que `visible` (seul le tablist lui-même a `auto`). Le sticky fonctionnera.
- Les 5 autres pages (détails, MesDocuments) : aucun `bpn-card` (`public/css/tailwind.css:157`, `overflow-hidden`) ni `overflow-*` dans les 4 lignes qui précèdent `<Tabs` (grep) ; à revérifier au rendu à l'étape 1 de la mission.
- Autres `overflow-hidden` des pages concernées sans effet sur le sticky (internes) : AvocatDetail:245 (barre de progression), Parametres:281 (logo), Parametres:382 (tableau).

## Jetons et polices (`tailwind.config.cjs`)
- Couleurs : `navy` DEFAULT `#1A3A6B` / 2 `#0d2247` / 3 `#0a1a36` ; `or` `#C4990A` (2 `#e8bc3a`, 3 `#f5d878`, L `#FDF6E3`, fonce `#8A6D08` pour le texte) ; `creme #FAF8F3` ; `grisL #F2EFE8` ; `grisM #E0DBD0` ; `gris #7A756A` ; `encre #1C1C18` ; `rouge #8B1A1A` ; `vert #1A5C3A` ; `rougeL`, `vertL`, `bleuL`.
- Polices (index.html:15, Google Fonts) : display Playfair Display (titres), sans DM Sans (corps), mono DM Mono (références). Aucune nouvelle police.
- Échelle de texte : jetons nommés uniquement (pas de `text-[Npx]`).
- Composants réutilisables : `src/barreau/components/` Badge, Notice, DataTable, Tabs, PageHeader (l.9, `flex flex-col ... sm:flex-row`), StatCard, Modal, Button, EmptyState, ErrorState, Pagination, FormField ; classes globales `bpn-card`, `bpn-btn`, `bpn-eyebrow` (`public/css/tailwind.css`).

## Exports et impression actuels
- window.print : `public/css/tailwind.css:248-274` `@media print` avec `@page { size: A4; margin: 18mm }`, tout masqué sauf `.bpn-print-zone`, `.bpn-no-print` masqué. Pas de pied ni de numérotation. Appelants : DocumentModal.jsx:46 (repli sans PDF serveur), Annuaire.jsx:51, CorpsElectoral.jsx:109, Stagiaires.jsx:176.
- jsPDF : `src/barreau/utils/exports.js` `exporterPdf` (html2canvas puis jsPDF `unit:"pt", format:"a4"`). Mode `page` (l.25-36) : une page, image mise à l'échelle, marge 14 pt, sans en-tête ni pied. Mode flux (l.39-56) : marge 40 pt, tranches PNG, sans en-tête, sans pied, sans « Page x/y ».

## Captures « avant » (instance http://localhost:4100, dist de 15:30 postérieur au dernier commit de src de 15:19, connecté SG)
- `docs/captures/m20261016/avant/parametres-1280.png` et `parametres-360.png` : onglet Notifications (panneau le plus long, 19 209 px) défilé jusqu'en bas. Mesure : le tablist est à `top = -18 199 px` à 1280 et `-18 647 px` à 360, donc entièrement hors écran ; à 360 px `scrollWidth = clientWidth = 352` (pas de débordement horizontal de page), le tablist défile en interne.
