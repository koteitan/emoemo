import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { naddrDecode } from '../nostr/nip19';
import PackView from './PackView';

// Entry point for NIP-19 `naddr` links (e.g. shared from other Nostr clients).
// Decodes the pointer and renders the pack, passing the naddr's relay hints so
// sets on relays the user doesn't normally read still resolve.
export default function PackAddr() {
  const { naddr } = useParams();
  const pointer = useMemo(() => (naddr ? naddrDecode(naddr) : null), [naddr]);
  if (!pointer) return <Navigate to="/" replace />;
  return (
    <PackView
      pubkey={pointer.pubkey}
      identifier={pointer.identifier}
      relayHints={pointer.relays}
    />
  );
}
