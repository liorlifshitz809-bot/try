import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [_, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-facade p-4">
      <div className="bg-card border-8 border-foreground rounded-3xl p-8 sm:p-12 cartoon-shadow text-center max-w-md w-full">
        <h1 className="text-6xl font-display font-bold text-destructive mb-4">404</h1>
        <h2 className="text-2xl font-bold text-foreground mb-4">Room Not Found</h2>
        <p className="text-muted-foreground font-medium mb-8">
          The practice room you're looking for seems to have vanished or never existed!
        </p>
        <Button onClick={() => setLocation("/")} size="lg" className="w-full text-lg h-14">
          Go Back Home
        </Button>
      </div>
    </div>
  );
}
