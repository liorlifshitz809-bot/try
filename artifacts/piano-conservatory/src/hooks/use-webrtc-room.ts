import { useEffect, useRef, useState, useCallback } from 'react';
import { nanoid } from 'nanoid';

type PeerData = {
  peerId: string;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isLidOpen: boolean;
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTCRoom(
  roomId: string,
  initialDisplayName: string,
  initialAvatarIndex: number,
  providedStream: MediaStream | null,
  initialCustomAvatarUrl?: string,
) {
  const myPeerId = useRef(nanoid()).current;

  const [localData] = useState<PeerData>({
    peerId: myPeerId,
    displayName: initialDisplayName || 'Anonymous Pianist',
    avatarIndex: initialAvatarIndex || 0,
    customAvatarUrl: initialCustomAvatarUrl,
    isMuted: false,
    isCameraOff: false,
    isLidOpen: false,
  });

  const [mutedState, setMutedState] = useState(false);
  const [cameraOffState, setCameraOffState] = useState(false);
  const [lidOpenState, setLidOpenState] = useState(false);
  const [peers, setPeers] = useState<Record<string, PeerData>>({});
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const reactionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // reconnectKey increments to trigger a clean reconnect without leaving the room page
  const [reconnectKey, setReconnectKey] = useState(0);
  const intentionalCloseRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});

  // Keep localStreamRef in sync
  useEffect(() => {
    localStreamRef.current = providedStream;
  }, [providedStream]);

  const sendWS = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const createPC = useCallback((targetPeerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWS({ type: 'signal', roomId, targetPeerId, fromPeerId: myPeerId, signal: { type: 'candidate', candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) setStreams(prev => ({ ...prev, [targetPeerId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        delete pcsRef.current[targetPeerId];
      }
    };

    pcsRef.current[targetPeerId] = pc;
    return pc;
  }, [roomId, myPeerId, sendWS]);

  const setReactionForPeer = useCallback((peerId: string, text: string) => {
    if (reactionTimers.current[peerId]) clearTimeout(reactionTimers.current[peerId]);
    setReactions(prev => ({ ...prev, [peerId]: text }));
    reactionTimers.current[peerId] = setTimeout(() => {
      setReactions(prev => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      delete reactionTimers.current[peerId];
    }, 4000);
  }, []);

  const sendReaction = useCallback((text: string) => {
    setReactionForPeer(myPeerId, text);
    sendWS({ type: 'reaction', roomId, fromPeerId: myPeerId, text });
  }, [myPeerId, roomId, sendWS, setReactionForPeer]);

  // Store latest callbacks in refs so the WS effect doesn't need them as deps
  // (avoids any accidental reconnect from a function reference changing)
  const createPCRef = useRef(createPC);
  createPCRef.current = createPC;
  const setReactionForPeerRef = useRef(setReactionForPeer);
  setReactionForPeerRef.current = setReactionForPeer;

  useEffect(() => {
    if (!providedStream) return;
    let mounted = true;
    intentionalCloseRef.current = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    // Keepalive: send a ping every 10 seconds to prevent proxy idle-timeout
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10000);

    ws.onopen = () => {
      if (!mounted) return;
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'join', roomId, peerId: myPeerId,
        displayName: localData.displayName, avatarIndex: localData.avatarIndex,
        customAvatarUrl: localData.customAvatarUrl,
      }));
    };

    ws.onmessage = async (event) => {
      if (!mounted) return;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.roomId && msg.roomId !== roomId) return;

      if (msg.type === 'pong') {
        // keepalive acknowledged — nothing to do
      } else if (msg.type === 'room-joined') {
        const existingPeers = (msg.peers as PeerData[]) ?? [];
        const map: Record<string, PeerData> = {};
        for (const p of existingPeers) {
          map[p.peerId] = { ...p, customAvatarUrl: p.customAvatarUrl, isMuted: false, isCameraOff: false, isLidOpen: false };
          const pc = createPCRef.current(p.peerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'signal', roomId, targetPeerId: p.peerId, fromPeerId: myPeerId, signal: { type: 'offer', sdp: pc.localDescription?.sdp } }));
          }
        }
        setPeers(map);
      } else if (msg.type === 'peer-joined') {
        const { peerId, displayName, avatarIndex, customAvatarUrl } = msg as { peerId: string; displayName: string; avatarIndex: number; customAvatarUrl?: string };
        if (peerId === myPeerId) return;
        setPeers(prev => ({ ...prev, [peerId]: { peerId, displayName, avatarIndex, customAvatarUrl, isMuted: false, isCameraOff: false, isLidOpen: false } }));
      } else if (msg.type === 'signal') {
        const { fromPeerId, signal } = msg as { fromPeerId: string; signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit } };
        if (fromPeerId === myPeerId) return;
        // Inline signal handling to avoid callback deps
        if (signal.type === 'offer') {
          let pc = pcsRef.current[fromPeerId];
          if (!pc) pc = createPCRef.current(fromPeerId);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          const pending = pendingCandidates.current[fromPeerId] ?? [];
          for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          pendingCandidates.current[fromPeerId] = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'signal', roomId, targetPeerId: fromPeerId, fromPeerId: myPeerId, signal: { type: 'answer', sdp: pc.localDescription?.sdp } }));
          }
        } else if (signal.type === 'answer') {
          const pc = pcsRef.current[fromPeerId];
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            const pending = pendingCandidates.current[fromPeerId] ?? [];
            for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            pendingCandidates.current[fromPeerId] = [];
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = pcsRef.current[fromPeerId];
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            if (!pendingCandidates.current[fromPeerId]) pendingCandidates.current[fromPeerId] = [];
            pendingCandidates.current[fromPeerId].push(signal.candidate);
          }
        }
      } else if (msg.type === 'peer-left') {
        const { peerId } = msg as { peerId: string };
        pcsRef.current[peerId]?.close();
        delete pcsRef.current[peerId];
        setPeers(prev => { const n = { ...prev }; delete n[peerId]; return n; });
        setStreams(prev => { const n = { ...prev }; delete n[peerId]; return n; });
      } else if (msg.type === 'state-update') {
        const { peerId, isMuted, isCameraOff, isLidOpen } = msg as { peerId: string; isMuted: boolean; isCameraOff: boolean; isLidOpen: boolean };
        if (peerId !== myPeerId) {
          setPeers(prev => prev[peerId] ? { ...prev, [peerId]: { ...prev[peerId], isMuted, isCameraOff, isLidOpen } } : prev);
        }
      } else if (msg.type === 'reaction') {
        const { fromPeerId, text } = msg as { fromPeerId: string; text: string };
        if (fromPeerId !== myPeerId) {
          setReactionForPeerRef.current(fromPeerId, text);
        }
      }
    };

    ws.onerror = () => { if (mounted) setIsConnected(false); };

    ws.onclose = () => {
      clearInterval(pingInterval);
      if (!mounted) return;
      setIsConnected(false);
      // Auto-reconnect if this wasn't an intentional close (user leaving the room)
      if (!intentionalCloseRef.current) {
        setTimeout(() => {
          if (mounted) {
            setPeers({});
            setStreams({});
            setReconnectKey(k => k + 1);
          }
        }, 2000);
      }
    };

    return () => {
      mounted = false;
      clearInterval(pingInterval);
      ws.close();
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      Object.values(reactionTimers.current).forEach(clearTimeout);
      reactionTimers.current = {};
    };
  // Only reconnect when stream arrives, room changes, or reconnectKey bumps.
  // All callbacks accessed via refs so they are excluded from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedStream, roomId, reconnectKey]);

  const toggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      sendWS({ type: 'state-update', roomId, peerId: myPeerId, isMuted: next, isCameraOff: cameraOffState, isLidOpen: lidOpenState });
      return next;
    });
  }, [roomId, myPeerId, cameraOffState, lidOpenState, sendWS]);

  const toggleCamera = useCallback(() => {
    setCameraOffState(prev => {
      const next = !prev;
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
      sendWS({ type: 'state-update', roomId, peerId: myPeerId, isMuted: mutedState, isCameraOff: next, isLidOpen: lidOpenState });
      return next;
    });
  }, [roomId, myPeerId, mutedState, lidOpenState, sendWS]);

  const broadcastLidState = useCallback((isLidOpen: boolean) => {
    sendWS({ type: 'state-update', roomId, peerId: myPeerId, isMuted: mutedState, isCameraOff: cameraOffState, isLidOpen });
  }, [roomId, myPeerId, mutedState, cameraOffState, sendWS]);

  return {
    peers,
    streams,
    localStream: providedStream,
    localData: { ...localData, isMuted: mutedState, isCameraOff: cameraOffState, isLidOpen: lidOpenState },
    isConnected,
    myPeerId,
    toggleMute,
    toggleCamera,
    setLidOpenState,
    broadcastLidState,
    reactions,
    sendReaction,
    intentionalCloseRef,
  };
}
