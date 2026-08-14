import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:4444'

type YjsHandle = {
  ydoc: Y.Doc
  provider: WebrtcProvider
}

// Created and destroyed inside the effect itself (not useMemo) so React
// StrictMode's dev-only mount->cleanup->mount cycle tears down and
// recreates a matched pair instead of destroying one instance while a
// separately-memoized one keeps getting used.
export function useYjs(room: string): YjsHandle | null {
  const [handle, setHandle] = useState<YjsHandle | null>(null)

  useEffect(() => {
    const ydoc = new Y.Doc()
    const provider = new WebrtcProvider(room, ydoc, { signaling: [SIGNALING_SERVER] })
    setHandle({ ydoc, provider })

    return () => {
      provider.destroy()
      ydoc.destroy()
      setHandle(null)
    }
  }, [room])

  return handle
}
