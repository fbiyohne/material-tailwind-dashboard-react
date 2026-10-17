import { useEffect, useState } from "react";
import { identite, onConfigChange, MENTION_DEMONSTRATION } from "../data/config";

/** Mention C-13, visible tant que l'identité de démonstration est active (back-office et espace avocat). */
export function BandeauDemonstration() {
  const [demo, setDemo] = useState(() => !!identite().modeDemonstration);
  useEffect(() => onConfigChange(() => setDemo(!!identite().modeDemonstration)), []);
  if (!demo) return null;
  return (
    <div role="note" className="border-b border-or bg-or-L px-4 py-1.5 text-center text-xs text-encre md:px-6">
      {MENTION_DEMONSTRATION}
    </div>
  );
}

export default BandeauDemonstration;
