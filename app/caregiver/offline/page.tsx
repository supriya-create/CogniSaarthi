import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import { CaregiverOfflineView } from "@/components/caregiver/CaregiverOfflineView";

/**
 * The caregiver's saved view.
 *
 * ## Why this page does NOT call `requireCaregiver()`
 *
 * It is the one caregiver route the service worker is allowed to cache
 * (see public/sw.js), and it can only be cached if its markup is the
 * same for everybody. So the server render deliberately contains
 * nothing: no elder name, no figures, no alerts — nothing that belongs
 * to anyone.
 *
 * All the content is read on the client from the per-caregiver
 * IndexedDB store, which is:
 *   - written only after an authenticated /api/caregiver/snapshot call,
 *   - keyed by caregiver id,
 *   - discarded when a different caregiver signs in on this device, and
 *   - cleared on sign-out.
 *
 * So the access control has not moved to the client — it happened on
 * the server when the snapshot was issued. This page can only ever show
 * what this device was already authorised to hold. Someone with no
 * snapshot sees an empty state, not somebody else's dashboard.
 *
 * Auth-gating it would defeat the purpose twice over: offline there is
 * no server to ask, and a gated response could not be cached.
 */
export default function CaregiverOfflinePage() {
  return (
    <CaregiverShell>
      <CaregiverOfflineView />
    </CaregiverShell>
  );
}
