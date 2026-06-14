/** @type {import('tailwindcss').Config} */
const withMT = require("@material-tailwind/react/utils/withMT");

/**
 * Design tokens — Barreau de Pointe-Noire
 * Identité institutionnelle marine & or, reprise fidèlement de la maquette UI/UX
 * (UIUX_Design_Barreau_PointeNoire). Source unique de vérité visuelle.
 */
module.exports = withMT({
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1A3A6B", // marine primaire
          2: "#0d2247", // marine foncé
          3: "#0a1a36", // marine très foncé (fonds sombres)
        },
        or: {
          DEFAULT: "#C4990A", // or principal
          2: "#e8bc3a", // or clair
          3: "#f5d878", // or très clair
          L: "#FDF6E3", // or pâle (fonds, badges)
        },
        creme: "#FAF8F3",
        grisL: "#F2EFE8",
        grisM: "#E0DBD0",
        gris: "#7A756A",
        encre: "#1C1C18",
        rouge: "#8B1A1A", // sémantique — danger / retard
        vert: "#1A5C3A", // sémantique — succès / à jour
        // Teintes pâles sémantiques (fonds de bandeaux, badges, toasts)
        rougeL: "#f4e6e6", // fond danger
        vertL: "#e6f4ee", // fond succès
        bleuL: "#e6edf4", // fond information (marine pâle)
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"], // titres institutionnels
        sans: ["'DM Sans'", "sans-serif"], // corps de texte
        mono: ["'DM Mono'", "monospace"], // références & codes
      },
      // Échelle typographique relevée pour la lisibilité / accessibilité
      // (malvoyants) : corps de texte plus généreux, sans toucher aux espacements.
      // xs 12→13 · sm 14→15 · base 16→17 · lg 18→19.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.15rem" }],
        sm: ["0.9375rem", { lineHeight: "1.4rem" }],
        base: ["1.0625rem", { lineHeight: "1.65rem" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],
      },
      maxWidth: {
        // Largeur de contenu élargie : les modules denses (tableaux, grilles)
        // exploitent l'espace disponible au lieu d'être tassés au centre.
        container: "1500px",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,.08)",
        "card-hover": "0 12px 40px rgba(0,0,0,.14)",
        modal: "0 8px 32px rgba(0,0,0,.12)",
      },
      keyframes: {
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "pulse-dot": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".4", transform: "scale(.7)" },
        },
      },
      animation: {
        "spin-slow": "spin-slow .7s linear infinite",
        "pulse-dot": "pulse-dot 2s infinite",
      },
    },
  },
  plugins: [],
});
