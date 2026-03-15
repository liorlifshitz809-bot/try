import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AVATARS = Array.from({ length: 16 }, (_, i) => i);

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { signup } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, displayName, avatarIndex);
      // Persist profile to localStorage for room page
      localStorage.setItem("piano-conservatory-profile", JSON.stringify({ displayName, avatarIndex }));
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-facade">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border-8 border-foreground rounded-3xl p-8 w-full max-w-md cartoon-shadow"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎹</div>
          <h1 className="text-3xl font-display font-bold">Create Account</h1>
          <p className="text-muted-foreground mt-1">Join the conservatory</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="font-bold">Display Name</Label>
            <Input
              id="name"
              placeholder="Beethoven Jr."
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              className="mt-1 border-2 border-foreground h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="email" className="font-bold">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="mt-1 border-2 border-foreground h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="password" className="font-bold">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="mt-1 border-2 border-foreground h-12 text-base"
            />
          </div>

          <div>
            <Label className="font-bold">Choose Your Avatar</Label>
            <div className="mt-2 grid grid-cols-8 gap-1 max-h-28 overflow-y-auto">
              {AVATARS.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvatarIndex(i)}
                  className={cn(
                    "p-1 rounded-lg border-2 transition-all",
                    avatarIndex === i ? "border-primary bg-primary/10 scale-110" : "border-transparent hover:border-muted"
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

          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-bold">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
