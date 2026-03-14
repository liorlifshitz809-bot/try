import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Play, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

export default function Home() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const saveProfile = () => {
    localStorage.setItem('piano-conservatory-profile', JSON.stringify({
      displayName: displayName.trim() || "Anonymous Pianist",
      avatarIndex
    }));
  };

  const handleCreateRoom = () => {
    if (!displayName.trim()) {
      toast({ title: "Name required", description: "Please enter your name first.", variant: "destructive" });
      return;
    }
    saveProfile();
    const roomId = roomName.trim()
      ? slugify(roomName) || Math.random().toString(36).substring(2, 9)
      : Math.random().toString(36).substring(2, 9);
    setLocation(`/room/${roomId}`);
  };

  const handleJoinRoom = () => {
    if (!displayName.trim()) {
      toast({ title: "Name required", description: "Please enter your name first.", variant: "destructive" });
      return;
    }
    if (!roomCode.trim()) {
      toast({ title: "Room code required", description: "Please enter a room code or name.", variant: "destructive" });
      return;
    }
    saveProfile();
    setLocation(`/room/${roomCode.trim()}`);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-facade relative overflow-hidden">
      
      <div className="max-w-md w-full relative z-10">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
          className="bg-card border-8 border-foreground rounded-3xl p-6 sm:p-8 cartoon-shadow text-center mb-8"
        >
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-primary">
            <Music className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display text-foreground mb-2">
            Piano Conservatory
          </h1>
          <p className="text-muted-foreground font-medium mb-8">
            Practice together in virtual rooms with real-time video!
          </p>

          <div className="space-y-6 text-left">
            <div>
              <label className="block font-bold mb-2 text-foreground">Your Name</label>
              <Input 
                placeholder="Mozart, Beethoven..." 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={20}
              />
            </div>

            <div>
              <label className="block font-bold mb-2 text-foreground">Choose an Avatar</label>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAvatarIndex(i)}
                    className={`relative rounded-xl border-4 transition-all overflow-hidden bg-background aspect-square flex items-center justify-center p-2
                      ${avatarIndex === i 
                        ? 'border-primary cartoon-shadow scale-105' 
                        : 'border-transparent hover:border-muted-foreground/30 hover:scale-105'}`}
                  >
                    <img 
                      src={`${import.meta.env.BASE_URL}images/avatar-${i}.png`} 
                      alt={`Avatar ${i}`} 
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                    {avatarIndex === i && (
                      <div className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold mb-2 text-foreground">
                Room Name <span className="text-muted-foreground font-normal text-sm">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Morning Practice, Beethoven Club..."
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                maxLength={50}
                onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
              />
              {roomName.trim() && (
                <p className="mt-1 text-xs text-muted-foreground font-medium">
                  Room link: <span className="text-primary font-bold">…/room/{slugify(roomName) || '…'}</span>
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-4">
              <Button
                onClick={handleCreateRoom}
                className="w-full text-lg h-14"
              >
                <Plus className="w-6 h-6 mr-2" />
                Create New Room
              </Button>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t-2 border-muted-foreground/20"></div>
                <span className="flex-shrink-0 mx-4 text-muted-foreground font-bold">OR</span>
                <div className="flex-grow border-t-2 border-muted-foreground/20"></div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Room name or code..."
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  className="bg-background"
                  onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                />
                <Button onClick={handleJoinRoom} variant="secondary" className="px-6 h-14 shrink-0">
                  <Play className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
