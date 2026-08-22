import { Component } from "react";
import PropTypes from "prop-types";

/** Capture les erreurs de rendu et affiche un écran de secours institutionnel. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-creme px-6 text-center">
          <div className="mb-4 font-display text-3xl text-navy">Une erreur est survenue</div>
          <p className="max-w-md text-sm text-gris">
            L'application a rencontré un problème inattendu. Vous pouvez recharger la page pour
            continuer.
          </p>
          <button className="bpn-btn bpn-btn-primary mt-6" onClick={() => window.location.assign("/")}>
            Revenir au tableau de bord
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node };

export default ErrorBoundary;
