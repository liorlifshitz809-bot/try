import { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, UserPlus, Check, X, Users, Play, Mail } from 'lucide-react';

interface UserResult {
  id: number;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
  friendshipStatus: string | null;
}

interface FriendRequest {
  id: number;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
  createdAt: string;
}

interface Friend {
  id: number;
  displayName: string;
  avatarIndex: number;
  customAvatarUrl?: string;
  online: boolean;
  roomId: string | null;
}

interface Invitation {
  id: number;
  roomId: string;
  createdAt: string;
  expiresAt: string;
  fromDisplayName: string;
  fromAvatarIndex: number;
  fromCustomAvatarUrl?: string;
}

function Avatar({ avatarIndex, customAvatarUrl, size = 'md' }: { avatarIndex: number; customAvatarUrl?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
  if (customAvatarUrl) {
    return <img src={customAvatarUrl} alt="avatar" className={`${cls} rounded-full object-cover border-2 border-foreground`} />;
  }
  return <img src={`${import.meta.env.BASE_URL}images/avatar-${avatarIndex}.png`} alt="avatar" className={`${cls} object-contain`} />;
}

type Tab = 'friends' | 'requests' | 'search' | 'invitations';

export default function FriendsPage() {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('friends');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  const [pendingActions, setPendingActions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setLocation('/login');
    }
  }, [user, setLocation]);

  const fetchFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends);
      }
    } catch {} finally {
      setFriendsLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/friends/requests', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      }
    } catch {} finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch('/api/friends/invitations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations);
      }
    } catch {} finally {
      setInvitationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchRequests();
    fetchInvitations();
    const interval = setInterval(() => {
      fetchFriends();
      fetchRequests();
      fetchInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchFriends, fetchRequests, fetchInvitations]);

  useEffect(() => {
    if (tab !== 'search' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users);
        }
      } catch {} finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, tab]);

  const handleSendRequest = async (addresseeId: number) => {
    setPendingActions(s => new Set(s).add(addresseeId));
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addresseeId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Request sent!' });
        setSearchResults(prev => prev.map(u => u.id === addresseeId ? { ...u, friendshipStatus: 'request_sent' } : u));
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setPendingActions(s => { const n = new Set(s); n.delete(addresseeId); return n; });
    }
  };

  const handleRespond = async (requesterId: number, action: 'accept' | 'reject') => {
    setPendingActions(s => new Set(s).add(requesterId));
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requesterId, action }),
      });
      if (res.ok) {
        toast({ title: action === 'accept' ? 'Friend added!' : 'Request declined' });
        setRequests(prev => prev.filter(r => r.id !== requesterId));
        if (action === 'accept') fetchFriends();
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setPendingActions(s => { const n = new Set(s); n.delete(requesterId); return n; });
    }
  };

  const handleMarkInvitationSeen = async (invId: number, roomId: string) => {
    try {
      await fetch(`/api/friends/invitations/${invId}/seen`, {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch {}
    setLocation(`/room/${roomId}`);
  };

  if (!user) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: 'My Friends', count: friends.length },
    { key: 'requests', label: 'Requests', count: requests.length },
    { key: 'invitations', label: 'Invitations', count: invitations.length },
    { key: 'search', label: 'Find People' },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-4 bg-facade">
      <div className="w-full max-w-lg">

        <div className="flex items-center gap-3 mb-4 pt-2">
          <Link href="/">
            <Button variant="outline" size="icon" className="border-2 border-foreground cartoon-shadow rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Friends
          </h1>
        </div>

        <div className="flex gap-1 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border-2 ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground border-primary cartoon-shadow'
                  : 'bg-card border-foreground/20 hover:border-foreground/40'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  tab === t.key ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-4 border-foreground rounded-3xl p-5 cartoon-shadow"
        >
          {tab === 'search' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {searchLoading && <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>}
              {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}
              <div className="space-y-2">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border-2 border-transparent hover:border-primary/20">
                    <Avatar avatarIndex={u.avatarIndex} customAvatarUrl={u.customAvatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{u.displayName}</p>
                    </div>
                    {u.friendshipStatus === 'friends' ? (
                      <span className="text-xs text-green-600 font-bold px-2 py-1 bg-green-50 rounded-lg">Friends</span>
                    ) : u.friendshipStatus === 'request_sent' ? (
                      <span className="text-xs text-muted-foreground font-bold px-2 py-1 bg-muted rounded-lg">Sent</span>
                    ) : u.friendshipStatus === 'request_received' ? (
                      <span className="text-xs text-primary font-bold px-2 py-1 bg-primary/10 rounded-lg">Respond</span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSendRequest(u.id)}
                        disabled={pendingActions.has(u.id)}
                        className="h-8 text-xs gap-1"
                      >
                        <UserPlus className="w-3 h-3" />
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-2">
              {requestsLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}
              {!requestsLoading && requests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>
              )}
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border-2 border-transparent hover:border-primary/20">
                  <Avatar avatarIndex={r.avatarIndex} customAvatarUrl={r.customAvatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{r.displayName}</p>
                    <p className="text-xs text-muted-foreground">wants to be friends</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleRespond(r.id, 'accept')}
                      disabled={pendingActions.has(r.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRespond(r.id, 'reject')}
                      disabled={pendingActions.has(r.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'friends' && (
            <div className="space-y-2">
              {friendsLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}
              {!friendsLoading && friends.length === 0 && (
                <div className="text-center py-6">
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No friends yet</p>
                  <Button size="sm" variant="outline" onClick={() => setTab('search')} className="gap-1.5">
                    <Search className="w-3 h-3" />
                    Find People
                  </Button>
                </div>
              )}
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border-2 border-transparent hover:border-primary/20">
                  <div className="relative">
                    <Avatar avatarIndex={f.avatarIndex} customAvatarUrl={f.customAvatarUrl} />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                      f.online ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{f.displayName}</p>
                    {f.online && f.roomId ? (
                      <p className="text-xs text-green-600 font-medium">Practicing in {f.roomId}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Offline</p>
                    )}
                  </div>
                  {f.online && f.roomId && (
                    <Button size="sm" onClick={() => setLocation(`/room/${f.roomId}`)} className="h-8 text-xs gap-1">
                      <Play className="w-3 h-3" />
                      Join
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'invitations' && (
            <div className="space-y-2">
              {invitationsLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}
              {!invitationsLoading && invitations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No pending invitations</p>
              )}
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl bg-background border-2 border-primary/20">
                  <Avatar avatarIndex={inv.fromAvatarIndex} customAvatarUrl={inv.fromCustomAvatarUrl} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{inv.fromDisplayName}</p>
                    <p className="text-xs text-primary font-medium">Invited you to room: {inv.roomId}</p>
                  </div>
                  <Button size="sm" onClick={() => handleMarkInvitationSeen(inv.id, inv.roomId)} className="h-8 text-xs gap-1">
                    <Play className="w-3 h-3" />
                    Join
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
