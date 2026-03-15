import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Clock, Calendar, ArrowLeft, Music, Pencil, Check, X, Camera, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  id: number;
  room_id: string;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number;
  notes: string | null;
  session_date: string;
  is_manual: boolean;
}

interface DailyStat {
  session_date: string;
  session_count: string;
  total_seconds: string;
}

interface Summary {
  today: { count: string; seconds: string };
  allTime: { count: string; seconds: string };
  streak: number;
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const today = new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout, updateProfile } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "history" | "add">("today");

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState(user?.avatarIndex ?? 0);
  const [pendingName, setPendingName] = useState(user?.displayName ?? "");
  const [pendingCustomAvatar, setPendingCustomAvatar] = useState<string | null | undefined>(undefined);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep pending values in sync when user changes (e.g. after initial load)
  useEffect(() => {
    if (user && !editingProfile) {
      setPendingAvatar(user.avatarIndex);
      setPendingName(user.displayName);
      setPendingCustomAvatar(undefined);
    }
  }, [user, editingProfile]);

  // Resize image to max 200×200 and return a JPEG data URL
  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 200;
        let { width, height } = img;
        const ratio = Math.min(MAX / width, MAX / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setPendingCustomAvatar(dataUrl);
    } catch {
      toast({ title: "Could not read that image", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleSaveProfile = async () => {
    if (!pendingName.trim()) {
      toast({ title: "Display name cannot be empty", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const patch: { displayName: string; avatarIndex: number; customAvatarUrl?: string | null } = {
        displayName: pendingName.trim(),
        avatarIndex: pendingAvatar,
      };
      // undefined = no change, null = remove, string = new photo
      if (pendingCustomAvatar !== undefined) patch.customAvatarUrl = pendingCustomAvatar;
      await updateProfile(patch);
      toast({ title: "Profile updated!" });
      setEditingProfile(false);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Add session form
  const [addDuration, setAddDuration] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addRoom, setAddRoom] = useState("");
  const [addDate, setAddDate] = useState(today);
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, summRes] = await Promise.all([
        fetch(`/api/dashboard/sessions?date=${selectedDate}`, { credentials: "include" }),
        fetch("/api/dashboard/summary", { credentials: "include" }),
      ]);
      if (sessRes.status === 401) { setLocation("/login"); return; }
      const sessData = await sessRes.json();
      const summData = await summRes.json();
      setSessions(sessData.sessions || []);
      setDailyStats(sessData.dailyStats || []);
      setSummary(summData);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, setLocation, toast]);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    fetchData();
  }, [user, setLocation, fetchData]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/dashboard/sessions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setSessions(s => s.filter(x => x.id !== id));
      toast({ title: "Session removed" });
      fetchData();
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseFloat(addDuration);
    if (!minutes || minutes <= 0) {
      toast({ title: "Enter a valid duration", variant: "destructive" });
      return;
    }
    const durationSeconds = Math.round(minutes * 60);
    if (durationSeconds < 60) {
      toast({ title: "Sessions under 1 minute are not recorded", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/dashboard/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds,
          notes: addNotes.trim() || undefined,
          roomId: addRoom.trim() || undefined,
          sessionDate: addDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Session added!" });
      setAddDuration(""); setAddNotes(""); setAddRoom("");
      setTab("today");
      setSelectedDate(addDate);
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to add session", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  if (!user) return null;

  const todaySeconds = parseInt(summary?.today.seconds || "0");
  const allTimeSeconds = parseInt(summary?.allTime.seconds || "0");

  return (
    <div className="min-h-screen bg-facade pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b-4 border-foreground">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full border-2 border-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {/* Avatar with edit button overlay */}
              <div className="relative group">
                {(() => {
                  const displayUrl = editingProfile
                    ? (pendingCustomAvatar !== undefined ? pendingCustomAvatar : user.customAvatarUrl)
                    : user.customAvatarUrl;
                  return displayUrl
                    ? <img src={displayUrl} alt={user.displayName} className="w-11 h-11 object-cover rounded-full border-2 border-foreground" />
                    : <img src={`${import.meta.env.BASE_URL}images/avatar-${editingProfile ? pendingAvatar : user.avatarIndex}.png`} alt={user.displayName} className="w-11 h-11 object-contain" />;
                })()}
                <button
                  onClick={() => {
                    setPendingAvatar(user.avatarIndex);
                    setPendingName(user.displayName);
                    setPendingCustomAvatar(undefined);
                    setEditingProfile(v => !v);
                  }}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary border-2 border-white rounded-full flex items-center justify-center shadow-sm hover:bg-primary/80 transition-colors"
                  title="Edit profile"
                >
                  <Pencil className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
              <div>
                <div className="font-display font-bold leading-tight">{user.displayName}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="border-2 border-foreground" onClick={async () => { await logout(); setLocation("/login"); }}>
            Sign Out
          </Button>
        </div>

        {/* Inline profile-edit panel */}
        <AnimatePresence>
          {editingProfile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t-4 border-foreground bg-card"
            >
              <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
                {/* Display name input */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                    Display Name
                  </Label>
                  <Input
                    value={pendingName}
                    onChange={e => setPendingName(e.target.value)}
                    maxLength={30}
                    className="border-2 border-foreground h-9 text-sm"
                  />
                </div>

                {/* Custom photo upload */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Profile Photo
                  </Label>
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    <div className="w-16 h-16 rounded-2xl border-4 border-foreground overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {(() => {
                        const preview = pendingCustomAvatar !== undefined ? pendingCustomAvatar : user.customAvatarUrl;
                        return preview
                          ? <img src={preview} alt="Custom avatar" className="w-full h-full object-cover" />
                          : <img src={`${import.meta.env.BASE_URL}images/avatar-${pendingAvatar}.png`} alt="Default avatar" className="w-full h-full object-contain p-1" />;
                      })()}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-2 w-full justify-start"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Upload Photo
                      </Button>
                      {(pendingCustomAvatar !== undefined ? pendingCustomAvatar : user.customAvatarUrl) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-2 border-destructive text-destructive hover:bg-destructive hover:text-white w-full justify-start"
                          onClick={() => setPendingCustomAvatar(null)}
                        >
                          <ImageOff className="w-3.5 h-3.5" />
                          Remove Photo
                        </Button>
                      )}
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Your photo replaces the avatar everywhere. Max 200×200px.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Avatar grid — used when no custom photo */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    {(pendingCustomAvatar !== undefined ? pendingCustomAvatar : user.customAvatarUrl)
                      ? "Fallback Avatar (used if photo removed)"
                      : "Choose Avatar"}
                  </Label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPendingAvatar(i)}
                        className={cn(
                          "rounded-xl border-2 p-1 transition-all aspect-square flex items-center justify-center",
                          pendingAvatar === i
                            ? "border-primary bg-primary/10 scale-110 shadow-sm"
                            : "border-transparent hover:border-muted-foreground/40 hover:bg-muted/50"
                        )}
                      >
                        <img
                          src={`${import.meta.env.BASE_URL}images/avatar-${i}.png`}
                          alt={`Avatar ${i}`}
                          className="w-8 h-8 object-contain"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {savingProfile ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-2"
                    onClick={() => setEditingProfile(false)}
                    disabled={savingProfile}
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Today", value: fmtDuration(todaySeconds), icon: "⏱️" },
            { label: "All Time", value: fmtDuration(allTimeSeconds), icon: "📊" },
            { label: "Sessions", value: summary?.allTime.count || "0", icon: "🎹" },
            { label: "Day Streak", value: `${summary?.streak || 0}🔥`, icon: "🔥" },
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-card border-4 border-foreground rounded-2xl p-4 text-center cartoon-shadow"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="font-display font-bold text-xl leading-tight">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-muted p-1 rounded-2xl border-4 border-foreground">
          {(["today", "history", "add"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-xl font-bold text-sm capitalize transition-all",
                tab === t ? "bg-card border-2 border-foreground cartoon-shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "today" ? "📅 Today" : t === "history" ? "📜 History" : "➕ Add"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "today" && (
            <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xl">{selectedDate === today ? "Today's Practice" : fmtDate(selectedDate)}</h2>
                <Input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-40 border-2 border-foreground text-sm h-9"
                />
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading…</div>
              ) : sessions.length === 0 ? (
                <div className="bg-card border-4 border-foreground rounded-2xl p-8 text-center cartoon-shadow">
                  <div className="text-4xl mb-3">🎹</div>
                  <p className="font-bold text-lg">No sessions recorded yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Open the piano lid in a room, or add one manually.</p>
                  <Button className="mt-4" onClick={() => setTab("add")}>
                    <Plus className="w-4 h-4 mr-2" /> Add Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => (
                    <SessionCard key={s.id} session={s} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h2 className="font-display font-bold text-xl mb-3">Practice History</h2>
              {dailyStats.length === 0 ? (
                <div className="bg-card border-4 border-foreground rounded-2xl p-8 text-center cartoon-shadow">
                  <p className="text-muted-foreground">No practice history yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dailyStats.map(stat => {
                    const date = stat.session_date.split("T")[0];
                    const secs = parseInt(stat.total_seconds);
                    const isToday = date === today;
                    return (
                      <button
                        key={date}
                        onClick={() => { setSelectedDate(date); setTab("today"); }}
                        className={cn(
                          "w-full bg-card border-4 rounded-2xl p-4 flex items-center justify-between cartoon-shadow hover:scale-[1.01] transition-transform text-left",
                          isToday ? "border-primary" : "border-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-bold">{isToday ? "Today" : fmtDate(date)}</div>
                            <div className="text-xs text-muted-foreground">{stat.session_count} session{parseInt(stat.session_count) !== 1 ? "s" : ""}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Clock className="w-4 h-4" />
                          {fmtDuration(secs)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === "add" && (
            <motion.div key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-card border-4 border-foreground rounded-2xl p-6 cartoon-shadow">
                <h2 className="font-display font-bold text-xl mb-4">Log a Practice Session</h2>
                <form onSubmit={handleAddSession} className="space-y-4">
                  <div>
                    <Label className="font-bold">Duration (minutes) *</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      placeholder="e.g. 30"
                      value={addDuration}
                      onChange={e => setAddDuration(e.target.value)}
                      required
                      className="mt-1 border-2 border-foreground h-11"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Sessions under 1 minute are not saved.</p>
                  </div>
                  <div>
                    <Label className="font-bold">Date</Label>
                    <Input
                      type="date"
                      value={addDate}
                      max={today}
                      onChange={e => setAddDate(e.target.value)}
                      className="mt-1 border-2 border-foreground h-11"
                    />
                  </div>
                  <div>
                    <Label className="font-bold">Room (optional)</Label>
                    <Input
                      placeholder="e.g. morning"
                      value={addRoom}
                      onChange={e => setAddRoom(e.target.value)}
                      className="mt-1 border-2 border-foreground h-11"
                    />
                  </div>
                  <div>
                    <Label className="font-bold">Notes (optional)</Label>
                    <Input
                      placeholder="What did you practice today?"
                      value={addNotes}
                      onChange={e => setAddNotes(e.target.value)}
                      className="mt-1 border-2 border-foreground h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 font-bold" disabled={adding}>
                    <Plus className="w-4 h-4 mr-2" />
                    {adding ? "Saving…" : "Save Session"}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SessionCard({ session, onDelete }: { session: Session; onDelete: (id: number) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card border-4 border-foreground rounded-2xl p-4 flex items-center justify-between cartoon-shadow gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0">
          <Music className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base">{fmtDuration(session.duration_seconds)}</span>
            {session.is_manual && (
              <span className="text-xs bg-muted border border-muted-foreground/30 px-1.5 py-0.5 rounded-full text-muted-foreground">manual</span>
            )}
            {session.room_id && session.room_id !== "manual" && (
              <span className="text-xs bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded-full text-primary font-medium">
                #{session.room_id}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {session.joined_at ? fmtTime(session.joined_at) : ""}
            {session.notes && <span className="ml-2 text-foreground/70">— {session.notes}</span>}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive flex-shrink-0"
        onClick={() => onDelete(session.id)}
        title="Delete session"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
