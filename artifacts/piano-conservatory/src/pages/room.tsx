import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Mic, MicOff, Video, VideoOff, Copy, PhoneOff, Music } from 'lucide-react';
import { useWebRTCRoom } from '@/hooks/use-webrtc-room';
import { RoomCell } from '@/components/RoomCell';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function RoomPage() {
  const [match, params] = useRoute('/room/:roomId');
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const roomId = params?.roomId || 'demo';

  // Load profile from local storage or set defaults
  const [profile, setProfile] = useState({ displayName: "Anonymous", avatarIndex: 0 });
  
  useEffect(() => {
    const saved = localStorage.getItem('piano-conservatory-profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {}
    } else {
      // If no profile, they skipped the home page. Redirect them to set one.
      setLocation('/');
    }
  }, [setLocation]);

  const {
    peers,
    streams,
    localStream,
    localData,
    isConnected,
    error,
    toggleMute,
    toggleCamera
  } = useWebRTCRoom(roomId, profile.displayName, profile.avatarIndex);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied!",
      description: "Send this link to friends so they can join.",
    });
  };

  const handleLeave = () => {
    setLocation('/');
  };

  // Convert peers object to array and ensure we have at most 8 peers (9 rooms total incl local)
  const peerList = Object.values(peers).slice(0, 8);
  const emptyRoomsCount = Math.max(0, 8 - peerList.length);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-facade">
        <div className="bg-card p-8 rounded-3xl border-8 border-destructive max-w-md text-center cartoon-shadow">
          <h2 className="text-3xl font-display text-destructive mb-4">Oops!</h2>
          <p className="font-bold text-foreground mb-6">{error}</p>
          <Button onClick={() => setLocation('/')} size="lg">Return Home</Button>
        </div>
      </div>
    );
  }

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
            {isConnected ? "Live" : "Connecting..."}
          </span>
        </div>
      </header>

      {/* Grid Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center pb-32">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Local User */}
          <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <RoomCell 
              peerId={localData.peerId}
              displayName={localData.displayName}
              avatarIndex={localData.avatarIndex}
              isMuted={localData.isMuted}
              isCameraOff={localData.isCameraOff}
              stream={localStream}
              isLocal={true}
            />
          </motion.div>

          {/* Remote Peers */}
          <AnimatePresence>
            {peerList.map((peer) => (
              <motion.div 
                key={peer.peerId}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", bounce: 0.4 }}
              >
                <RoomCell 
                  peerId={peer.peerId}
                  displayName={peer.displayName}
                  avatarIndex={peer.avatarIndex}
                  isMuted={peer.isMuted}
                  isCameraOff={peer.isCameraOff}
                  stream={streams[peer.peerId]}
                  isLocal={false}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty Rooms */}
          {Array.from({ length: emptyRoomsCount }).map((_, i) => (
            <div key={`empty-${i}`} className="hidden sm:block opacity-60">
              <RoomCell peerId={`empty-${i}`} isEmpty={true} />
            </div>
          ))}

        </div>
      </main>

      {/* Bottom Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-card border-4 border-foreground p-3 rounded-3xl cartoon-shadow flex items-center gap-2 sm:gap-4 px-4 sm:px-6">
          
          <Button 
            variant={localData.isMuted ? "destructive" : "secondary"} 
            size="icon" 
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16"
            onClick={toggleMute}
            title={localData.isMuted ? "Unmute" : "Mute"}
          >
            {localData.isMuted ? <MicOff className="w-6 h-6 sm:w-8 sm:h-8" /> : <Mic className="w-6 h-6 sm:w-8 sm:h-8" />}
          </Button>

          <Button 
            variant={localData.isCameraOff ? "destructive" : "secondary"} 
            size="icon" 
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16"
            onClick={toggleCamera}
            title={localData.isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
          >
            {localData.isCameraOff ? <VideoOff className="w-6 h-6 sm:w-8 sm:h-8" /> : <Video className="w-6 h-6 sm:w-8 sm:h-8" />}
          </Button>

          <div className="w-1 h-10 bg-muted-foreground/20 rounded-full mx-1 sm:mx-2"></div>

          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 border-4"
            onClick={handleCopyLink}
            title="Copy Invite Link"
          >
            <Copy className="w-6 h-6 sm:w-7 sm:h-7" />
          </Button>

          <Button 
            variant="destructive" 
            className="rounded-full h-14 sm:h-16 px-6 font-bold text-lg ml-2"
            onClick={handleLeave}
          >
            <PhoneOff className="w-6 h-6 sm:mr-2" />
            <span className="hidden sm:inline-block">Leave</span>
          </Button>

        </div>
      </div>
    </div>
  );
}
