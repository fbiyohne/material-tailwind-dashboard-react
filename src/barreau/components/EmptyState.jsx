import PropTypes from "prop-types";
import { InboxIcon } from "@heroicons/react/24/outline";

/** État vide réutilisable et soigné (listes sans résultat). */
export function EmptyState({ icon: Icon = InboxIcon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-grisL text-gris">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-display text-base text-navy">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gris">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.node,
};

export default EmptyState;
