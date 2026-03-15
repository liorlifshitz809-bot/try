import { useEffect, useState, useCallback, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Mic, MicOff, Video, VideoOff, Copy, PhoneOff, Music, Camera, Trophy } from 'lucide-react';
import { useWebRTCRoom } from '@/hooks/use-webrtc-room';
import { RoomCell } from '@/components/RoomCell';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaderboard } from '@/components/Leaderboard';

// Read profile synchronously so useWebRTCRoom gets the correct initial values right away
function loadProfile(): { displayName: string; avatarIndex: number } {
  try {
    const saved = localStorage.getItem('piano-conservatory-profile');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.displayName) return p;
    }
  } catch {}
  return { displayName: 'Anonymous', avatarIndex: 0 };
}

export default function RoomPage() {
  const [match, params] = useRoute('/room/:roomId');
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const roomId = (params?.roomId || 'demo').toLowerCase();

  // Profile loaded synchronously — hook captures the correct values immediately
  const [profile] = useState(loadProfile);

  // Redirect home if no profile was ever saved
  useEffect(() => {
    const saved = localStorage.getItem('piano-conservatory-profile');
    if (!saved) setLocation('/');
  }, [setLocation]);

  // Stream is provided by the user tapping the "Allow Camera" button
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Lid state & session tracking
  const [isLidOpen, setIsLidOpen] = useState(false);
  const activeSessionId = useRef<number | null>(null);

  // Leaderboard panel
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const handleStartCamera = useCallback(async () => {
    setRequestingPermission(true);
    setPermissionError(null);
    try {
      // Try video + audio first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (videoErr) {
      // Fallback: try audio-only (some devices/browsers block video but not audio)
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(audioOnly);
        toast({ title: 'Camera not available', description: 'Joined with audio only — camera could not be accessed.' });
      } catch {
        const msg = videoErr instanceof Error ? videoErr.message : String(videoErr);
        if (msg.includes('Permission denied') || msg.includes('NotAllowed') || msg.includes('dismissed')) {
          setPermissionError('Camera and microphone access was denied. Tap the camera icon in your browser address bar to allow it, then try again.');
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setPermissionError('No camera or microphone found on this device.');
        } else {
          setPermissionError('Could not start camera. Make sure no other app is using it, then try again.');
        }
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [toast]);

  const {
    peers,
    streams,
    localData,
    isConnected,
    myPeerId,
    toggleMute,
    toggleCamera,
    setLidOpenState,
    broadcastLidState,
  } = useWebRTCRoom(roomId, profile.displayName, profile.avatarIndex, localStream);

  // Open/close the piano lid and track the practice session
  const handleToggleLid = useCallback(async () => {
    const next = !isLidOpen;
    setIsLidOpen(next);
    setLidOpenState(next);
    broadcastLidState(next);

    if (next) {
      // Opening lid → start a session
      try {
        const res = await fetch('/api/sessions/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peerId: myPeerId, displayName: profile.displayName, roomId }),
        });
        if (res.ok) {
          const data = await res.json();
          activeSessionId.current = data.sessionId;
        }
      } catch {/* non-critical */}
    } else {
      // Closing lid → end the session
      if (activeSessionId.current !== null) {
        try {
          await fetch('/api/sessions/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: activeSessionId.current }),
          });
        } catch {/* non-critical */}
        activeSessionId.current = null;
      }
    }
  }, [isLidOpen, myPeerId, profile.displayName, roomId, setLidOpenState, broadcastLidState]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied!', description: 'Send this link to friends so they can join.' });
  };

  const handleLeave = useCallback(async () => {
    // Close the lid / end session if still open
    if (isLidOpen && activeSessionId.current !== null) {
      try {
        await fetch('/api/sessions/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionId.current }),
        });
      } catch {/* non-critical */}
    }
    localStream?.getTracks().forEach(t => t.stop());
    setLocation('/');
  }, [isLidOpen, localStream, setLocation]);

  // Pre-join screen
  if (!localStream) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-facade">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border-8 border-foreground rounded-3xl p-8 max-w-sm w-full text-center cartoon-shadow"
        >
          <div className="text-6xl mb-4">🎹</div>
          <h2 className="text-2xl font-display font-bold mb-1">Ready to Practice?</h2>
          <p className="text-muted-foreground font-medium mb-1 text-sm">
            Room: <span className="font-bold text-foreground">{roomId}</span>
          </p>
          <p className="text-muted-foreground text-sm mb-2">
            Joining as: <span className="font-bold text-foreground">{profile.displayName}</span>
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            Tap below to allow your camera and microphone, then join.
          </p>

          {permissionError && (
            <div className="bg-destructive/10 border-2 border-destructive text-destructive rounded-xl p-3 mb-4 text-sm font-medium text-left">
              {permissionError}
              <button
                className="block mt-2 text-xs underline font-normal"
                onClick={() => setPermissionError(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          <Button
            onClick={handleStartCamera}
            disabled={requestingPermission}
            className="w-full h-14 text-lg mb-3"
          >
            <Camera className="w-5 h-5 mr-2" />
            {requestingPermission ? 'Asking for permission…' : permissionError ? 'Try Again' : 'Allow Camera & Mic'}
          </Button>

          <Button variant="ghost" className="w-full" onClick={() => setLocation('/')}>
            Go back
          </Button>
        </motion.div>
      </div>
    );
  }

  const peerList = Object.values(peers).slice(0, 8);
  const emptyRoomsCount = Math.max(0, 8 - peerList.length);

  return (
    <div className="min-h-screen flex flex-col bg-facade">

      {/* Top Bar */}
      <header className="w-full p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="bg-card/90 backdrop-blur border-4 border-foreground px-4 py-2 rounded-2xl flex items-center gap-3 cartoon-shadow">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-foreground">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">Conservatory</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Room: {roomId}</p>
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur border-4 border-foreground px-4 py-2 rounded-2xl flex items-center gap-2 cartoon-shadow">
          <span className="relative flex h-3 w-3">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-foreground"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 border border-foreground"></span>
            )}
          </span>
          <span className="font-bold text-sm hidden sm:inline-block">
            {isConnected ? 'Live' : 'Connecting…'}
          </span>
        </div>
      </header>

      {/* Leaderboard Sidebar */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-4 top-20 z-40 w-72"
          >
            <Leaderboard roomId={roomId} currentUserName={profile.displayName} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center pb-32">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">

          <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <RoomCell
              peerId={localData.peerId}
              displayName={localData.displayName}
              avatarIndex={localData.avatarIndex}
              isMuted={localData.isMuted}
              isCameraOff={localData.isCameraOff}
              isLidOpen={isLidOpen}
              stream={localStream}
              isLocal={true}
            />
          </motion.div>

          <AnimatePresence>
            {peerList.map((peer) => (
              <motion.div
                key={peer.peerId}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', bounce: 0.4 }}
              >
                <RoomCell
                  peerId={peer.peerId}
                  displayName={peer.displayName}
                  avatarIndex={peer.avatarIndex}
                  isMuted={peer.isMuted}
                  isCameraOff={peer.isCameraOff}
                  isLidOpen={peer.isLidOpen}
                  stream={streams[peer.peerId]}
                  isLocal={false}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {Array.from({ length: emptyRoomsCount }).map((_, i) => (
            <div key={`empty-${i}`} className="hidden sm:block opacity-60">
              <RoomCell peerId={`empty-${i}`} isEmpty={true} />
            </div>
          ))}
        </div>
      </main>

      {/* Bottom Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-card border-4 border-foreground p-3 rounded-3xl cartoon-shadow flex items-center gap-2 sm:gap-3 px-4 sm:px-5">

          {/* Mute */}
          <Button
            variant={localData.isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14"
            onClick={toggleMute}
            title={localData.isMuted ? 'Unmute' : 'Mute'}
          >
            {localData.isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>

          {/* Camera */}
          <Button
            variant={localData.isCameraOff ? 'destructive' : 'secondary'}
            size="icon"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14"
            onClick={toggleCamera}
            title={localData.isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {localData.isCameraOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </Button>

          <div className="w-px h-8 bg-muted-foreground/20 mx-1"></div>

          {/* Piano Lid Toggle — the main new feature */}
          <Button
            variant={isLidOpen ? 'default' : 'outline'}
            className={`rounded-full h-12 sm:h-14 px-4 sm:px-5 font-bold border-4 text-sm transition-all ${
              isLidOpen
                ? 'bg-green-500 hover:bg-green-600 border-green-700 text-white'
                : 'border-foreground'
            }`}
            onClick={handleToggleLid}
            title={isLidOpen ? 'Close Lid (stop recording)' : 'Open Lid (start recording)'}
          >
            <span className="text-lg mr-1 sm:mr-2">{isLidOpen ? '🎹' : '🎹'}</span>
            <span className="hidden sm:inline-block">{isLidOpen ? 'Close Lid' : 'Open Lid'}</span>
            <span className="sm:hidden">{isLidOpen ? '✓' : '+'}</span>
          </Button>

          <div className="w-px h-8 bg-muted-foreground/20 mx-1"></div>

          {/* Leaderboard Toggle */}
          <Button
            variant={showLeaderboard ? 'default' : 'outline'}
            size="icon"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 border-4"
            onClick={() => setShowLeaderboard(v => !v)}
            title="Toggle Leaderboard"
          >
            <Trophy className="w-5 h-5" />
          </Button>

          {/* Copy Link */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-12 h-12 sm:w-14 sm:h-14 border-4"
            onClick={handleCopyLink}
            title="Copy Invite Link"
          >
            <Copy className="w-5 h-5" />
          </Button>

          {/* Leave */}
          <Button
            variant="destructive"
            className="rounded-full h-12 sm:h-14 px-4 sm:px-5 font-bold ml-1"
            onClick={handleLeave}
          >
            <PhoneOff className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline-block">Leave</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
