// The account hub pulls in the dialog primitive and five tabs' worth of code,
// and only signed-in users ever open it. Splitting it out keeps that weight
// off the first paint — which is the whole promise of the home screen.

import { Suspense, lazy } from 'react';
import type { Tab } from './AccountModal';

const Impl = lazy(() => import('./AccountModal').then((m) => ({ default: m.AccountModal })));

export function AccountModal(props: { initialTab: Tab; onClose: () => void }) {
  // No fallback: the modal opens on a click, and a spinner that flashes for
  // one frame is worse than the dialog simply appearing.
  return (
    <Suspense fallback={null}>
      <Impl {...props} />
    </Suspense>
  );
}
