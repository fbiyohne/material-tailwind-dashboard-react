import { Redirect } from 'expo-router';
import { hasAcceptedDisclaimer } from '@/data/kv/settings';
import { useSessionStore } from '@/state/sessionStore';

/** Entry gate: disclaimer → onboarding → main app, based on stored state. */
export default function Index() {
  const activeProfileId = useSessionStore((s) => s.activeProfileId);
  if (!hasAcceptedDisclaimer() || !activeProfileId) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/live" />;
}
