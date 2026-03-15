import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Play, Plus, Clock, DoorOpen, LayoutDashboard, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

function slugify(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40);
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return 'less than a minute';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

type Session = {
  id: number;
  room_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number | null;
};

export default function Home() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading, logout } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Populate profile from auth or localStorage
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setAvatarIndex(user.avatarIndex);
      // Also persist so room.tsx can read it synchronously
      localStorage.setItem('piano-conservatory-profile', JSON.stringify({
        displayName: user.displayName,
        avatarIndex: user.avatarIndex,
        customAvatarUrl: user.customAvatarUrl,
      }));
    } else {
      const saved = localStorage.getItem('piano-conservatory-profile');
      if (saved) {
        try {
          const p = JSON.parse(saved);
          setDisplayName(p.displayName || '');
          setAvatarIndex(p.avatarIndex || 0);
        } catch {}
      }
    }
  }, [user]);

  const fetchSessions = useCallback(async (name: string) => {
    if (!name.trim()) { setSessions([]); return; }
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/sessions?name=${encodeURIComponent(name.trim())}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {} finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchSessions(displayName), 600);
    return () => clearTimeout(timer);
  }, [displayName, fetchSessions]);

  const saveProfile = () => {
    localStorage.setItem('piano-conservatory-profile', JSON.stringify({
      displayName: displayName.trim() || 'Anonymous Pianist',
      avatarIndex,
      customAvatarUrl: user?.customAvatarUrl,
    }));
  };

  const handleCreateRoom = () => {
    if (!displayName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your name first.', variant: 'destructive' });
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
      toast({ title: 'Name required', description: 'Please enter your name first.', variant: 'destructive' });
      return;
    }
    if (!roomCode.trim()) {
      toast({ title: 'Room code required', description: 'Please enter a room code or name.', variant: 'destructive' });
      return;
    }
    saveProfile();
    setLocation(`/room/${roomCode.trim().toLowerCase()}`);
  };

  const completedSessions = sessions.filter(s => s.left_at !== null);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-4 bg-facade relative overflow-hidden">

      {/* Auth Header */}
      <div className="w-full max-w-md mb-4 flex justify-end gap-2 pt-2">
        {authLoading ? null : user ? (
          <>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-2 border-foreground gap-1.5 cartoon-shadow">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="border-2 border-foreground gap-1.5"
              onClick={async () => {
                await logout();
                localStorage.removeItem('piano-conservatory-profile');
                setDisplayName('');
                setSessions([]);
              }}
            >
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="outline" size="sm" className="border-2 border-foreground gap-1.5 cartoon-shadow">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5">
                <UserPlus className="w-4 h-4" />
                Sign Up
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="max-w-md w-full relative z-10">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
          className="bg-card border-8 border-foreground rounded-3xl p-6 sm:p-8 cartoon-shadow text-center mb-6"
        >
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-primary">
            <Music className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-display text-foreground mb-2">
            אפליקציית האימונים
          </h1>
          <p className="text-muted-foreground font-medium mb-8">
            Practice together in virtual rooms with real-time video!
          </p>

          {user && (
            <div className="flex items-center gap-3 bg-primary/5 border-2 border-primary/30 rounded-xl px-4 py-2 mb-6 text-left">
              <img
                src={`${import.meta.env.BASE_URL}images/avatar-${user.avatarIndex}.png`}
                alt={user.displayName}
                className="w-10 h-10 object-contain"
              />
              <div>
                <div className="font-bold text-sm">{user.displayName}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          )}

          <div className="space-y-6 text-left">
            {!user && (
              <div>
                <label className="block font-bold mb-2 text-foreground">Your Name</label>
                <Input
                  placeholder="Mozart, Beethoven..."
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={20}
                />
              </div>
            )}

            {!user && (
              <div>
                <label className="block font-bold mb-2 text-foreground">Choose an Avatar</label>
                <div className="max-h-52 overflow-y-auto rounded-xl pr-1 -mr-1">
                  <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    {Array.from({ length: 16 }).map((_, i) => (
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
              </div>
            )}

            <div>
              <label className="block font-bold mb-2 text-foreground">
                Room Name <span className="text-muted-foreground font-normal text-sm">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Morning Practice, Team Meeting..."
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
              <Button onClick={handleCreateRoom} className="w-full text-lg h-14">
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

        {/* Session History */}
        <AnimatePresence>
          {displayName.trim() && (sessionsLoading || completedSessions.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-card border-4 border-foreground rounded-3xl p-5 cartoon-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">
                    Recent Sessions
                  </h2>
                </div>
                {user && (
                  <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                      See all →
                    </Button>
                  </Link>
                )}
              </div>

              {sessionsLoading && completedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Loading…</p>
              ) : completedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No sessions yet — join a room to get started!</p>
              ) : (
                <div className="space-y-2">
                  {completedSessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { saveProfile(); setLocation(`/room/${s.room_id}`); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-background hover:bg-primary/5 border-2 border-transparent hover:border-primary/30 transition-all text-left group"
                    >
                      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <DoorOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{s.room_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(s.joined_at)}
                          {s.duration_seconds !== null && (
                            <> · <span className="text-primary font-medium">{formatDuration(s.duration_seconds)}</span></>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

