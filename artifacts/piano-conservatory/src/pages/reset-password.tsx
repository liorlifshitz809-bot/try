import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function getTokenFromSearch(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = getTokenFromSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
      } else {
        setDone(true);
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
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
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-3xl font-display font-bold">New Password</h1>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <p className="font-bold text-lg">Password updated!</p>
            <Button className="w-full h-12" onClick={() => setLocation("/login")}>
              Go to Login
            </Button>
          </div>
        ) : !token ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Invalid or missing reset token.</p>
            <Link href="/forgot-password">
              <Button className="w-full h-12">Request a new link</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="font-bold">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="mt-1 border-2 border-foreground h-12"
              />
            </div>
            <div>
              <Label htmlFor="confirm" className="font-bold">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="mt-1 border-2 border-foreground h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
              {loading ? "Updating…" : "Update Password"}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
