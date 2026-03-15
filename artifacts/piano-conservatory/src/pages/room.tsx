import { useEffect, useState, useCallback, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Mic, MicOff, Video, VideoOff, Copy, PhoneOff, Music, Camera, Trophy, Smile } from 'lucide-react';
import { useWebRTCRoom } from '@/hooks/use-webrtc-room';
import { RoomCell } from '@/components/RoomCell';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaderboard } from '@/components/Leaderboard';

const REACTION_EMOJIS = ['👍', '👏', '😄', '😂', '🔥', '❤️', '😮', '🤔'];
const REACTION_SENTENCES = [
  '״טוב חלאס עם הדיבורים״',
  '״בהצלחה באימון!״',
  '״חדל קשקשת, חפירות זה לווטסאפ״',
  '״אין לי כוחחח״',
  '״וואי כמה פדל שמתי״',
  '״בואנה זה נשמע גרוע״',
  '״בואנה זה נשמע מדהים״',
  '״טוב התאמנתי מספיק להיום״',
  '״קשה באימונים קל בקרב״',
  '״הגיע הזמן לקצב״',
  '״תכף אחזור״',
  '״הלכתי לישון״',

];

// Read profile synchronously so useWebRTCRoom gets the correct initial values right away
function loadProfile(): { displayName: string; avatarIndex: number; customAvatarUrl?: string } {
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

  // Reaction picker
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  const handleStartCamera = useCallback(async () => {
    setRequestingPermission(true);
    setPermissionError(null);

    // Check for mediaDevices API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError('Your browser does not support camera access. Try Chrome or Safari on a modern device.');
      setRequestingPermission(false);
      return;
    }

    // Try progressively relaxed constraint sets so mobile Chrome has the best chance
    const videoConstraintSets = [
      // 1. Mobile-friendly: front-facing camera, capped resolution
      { video: { facingMode: { ideal: 'user' }, width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 } }, audio: true },
      // 2. Simple true/true — many desktop browsers prefer this
      { video: true, audio: true },
      // 3. Video only (in case the mic is the problem)
      { video: { facingMode: { ideal: 'user' } }, audio: false },
    ] as MediaStreamConstraints[];

    let stream: MediaStream | null = null;
    let lastErr: unknown = null;

    for (const constraints of videoConstraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!constraints.audio) {
          toast({ title: 'No microphone', description: 'Joined with video only — microphone could not be accessed.' });
        }
        break; // success
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Don't keep retrying on permission errors — the user said no
        if (msg.includes('NotAllowed') || msg.includes('Permission denied') || msg.includes('dismissed')) break;
      }
    }

    if (stream) {
      setLocalStream(stream);
      setRequestingPermission(false);
      return;
    }

    // All video attempts failed — try audio-only as a last resort
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(audioOnly);
      toast({ title: 'Camera not available', description: 'Joined with audio only — camera could not be accessed.' });
    } catch {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      if (msg.includes('NotAllowed') || msg.includes('Permission denied') || msg.includes('dismissed')) {
        setPermissionError('Camera and microphone access was denied. Tap the camera icon in your browser address bar to allow it, then try again.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound') || msg.includes('Devices not found')) {
        setPermissionError('No camera or microphone found on this device.');
      } else {
        setPermissionError(`Could not start camera (${msg}). Make sure no other app is using it, then try again.`);
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [toast]);

  const handleStartAudioOnly = useCallback(async () => {
    setRequestingPermission(true);
    setPermissionError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError('Your browser does not support microphone access.');
      setRequestingPermission(false);
      return;
    }
    try {
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(audioOnly);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowed') || msg.includes('Permission denied') || msg.includes('dismissed')) {
        setPermissionError('Microphone access was denied. Tap the microphone icon in your browser address bar to allow it.');
      } else {
        setPermissionError('Could not access microphone. Make sure it is not in use by another app.');
      }
    } finally {
      setRequestingPermission(false);
    }
  }, []);

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
    reactions,
    sendReaction,
    intentionalCloseRef,
  } = useWebRTCRoom(roomId, profile.displayName, profile.avatarIndex, localStream, profile.customAvatarUrl);

  // Close reaction picker when clicking outside
  useEffect(() => {
    if (!showReactionPicker) return;
    const handler = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showReactionPicker]);

  const handleReaction = useCallback((text: string) => {
    sendReaction(text);
    setShowReactionPicker(false);
  }, [sendReaction]);

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
    intentionalCloseRef.current = true;
    localStream?.getTracks().forEach(t => t.stop());
    setLocation('/');
  }, [isLidOpen, localStream, setLocation, intentionalCloseRef]);

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
            Tap below to allow camera &amp; microphone, or join with audio only.
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
            {requestingPermission ? 'Asking for permission…' : permissionError ? 'Try Again with Camera' : 'Allow Camera & Mic'}
          </Button>

          <Button
            variant="outline"
            onClick={handleStartAudioOnly}
            disabled={requestingPermission}
            className="w-full mb-3"
          >
            <Mic className="w-4 h-4 mr-2" />
            Join with Mic Only (no camera)
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
              customAvatarUrl={localData.customAvatarUrl}
              isMuted={localData.isMuted}
              isCameraOff={localData.isCameraOff}
              isLidOpen={isLidOpen}
              stream={localStream}
              isLocal={true}
              reaction={reactions[myPeerId]}
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
                  customAvatarUrl={peer.customAvatarUrl}
                  isMuted={peer.isMuted}
                  isCameraOff={peer.isCameraOff}
                  isLidOpen={peer.isLidOpen}
                  stream={streams[peer.peerId]}
                  isLocal={false}
                  reaction={reactions[peer.peerId]}
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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1.5rem)] sm:w-auto max-w-[calc(100vw-1.5rem)]">
        <div className="overflow-x-auto rounded-3xl" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-card border-4 border-foreground p-2.5 sm:p-3 rounded-3xl cartoon-shadow flex items-center gap-2 sm:gap-3 px-3 sm:px-5 w-max mx-auto">

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

          {/* Reaction Picker */}
          <div className="relative" ref={reactionPickerRef}>
            <Button
              variant={showReactionPicker ? 'default' : 'outline'}
              size="icon"
              className="rounded-full w-12 h-12 sm:w-14 sm:h-14 border-4"
              onClick={() => setShowReactionPicker(v => !v)}
              title="Send Reaction"
            >
              <Smile className="w-5 h-5" />
            </Button>
            <AnimatePresence>
              {showReactionPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-card border-4 border-foreground rounded-2xl cartoon-shadow p-3 w-64 sm:w-72 z-[60]"
                >
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className="text-2xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-muted active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="border-t-2 border-muted pt-2 max-h-48 overflow-y-auto space-y-1" dir="rtl">
                    {REACTION_SENTENCES.map((sentence) => (
                      <button
                        key={sentence}
                        onClick={() => handleReaction(sentence)}
                        className="w-full text-right text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-muted active:bg-muted/70 transition-colors"
                      >
                        {sentence}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
    </div>
  );
}
