import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetUrl = resetToken
    ? `${window.location.origin}${import.meta.env.BASE_URL}reset-password?token=${resetToken}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-facade">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border-8 border-foreground rounded-3xl p-8 w-full max-w-md cartoon-shadow"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-3xl font-display font-bold">Forgot Password</h1>
          <p className="text-muted-foreground mt-1">Enter your email to get a reset link</p>
        </div>

        {resetUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4 text-sm">
              <p className="font-bold text-green-800 mb-2">Reset link generated!</p>
              <p className="text-green-700 mb-3">Copy and open this link to reset your password:</p>
              <div className="bg-white border border-green-300 rounded p-2 break-all text-xs text-green-900 font-mono select-all">
                {resetUrl}
              </div>
            </div>
            <Link href={`/reset-password?token=${resetToken}`}>
              <Button className="w-full h-12">Go to Reset Password</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="font-bold">Email Address</Label>
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
            {error && (
              <div className="text-sm text-destructive font-medium">{error}</div>
            )}
            <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
