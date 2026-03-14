import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

function PianoSVG() {
  return (
    <svg viewBox="0 0 320 130" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-label="Piano">
      {/* Piano body */}
      <rect x="10" y="50" width="300" height="72" rx="6" ry="6" fill="#1a1008" stroke="#000" strokeWidth="3"/>

      {/* Lid open - propped up at an angle */}
      <polygon points="10,50 310,50 250,8 70,8" fill="#2a1a0c" stroke="#000" strokeWidth="3"/>
      {/* Lid prop stick */}
      <line x1="230" y1="12" x2="240" y2="50" stroke="#6b4226" strokeWidth="3" strokeLinecap="round"/>

      {/* Fallboard (the front panel above keys) */}
      <rect x="10" y="50" width="300" height="14" rx="0" fill="#2a1a0c" stroke="#000" strokeWidth="2"/>

      {/* Key bed */}
      <rect x="15" y="86" width="290" height="32" rx="4" fill="#f5f0e8" stroke="#000" strokeWidth="2"/>

      {/* White keys */}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect
          key={`wk-${i}`}
          x={15 + i * (290 / 14)}
          y={86}
          width={290 / 14 - 2}
          height={32}
          rx="2"
          fill="#fffef5"
          stroke="#ccc"
          strokeWidth="1"
        />
      ))}

      {/* Black keys — positions match a real piano pattern */}
      {[1, 2, 4, 5, 6, 8, 9, 11, 12, 13].map((pos) => (
        <rect
          key={`bk-${pos}`}
          x={15 + pos * (290 / 14) - (290 / 14) * 0.3}
          y={86}
          width={(290 / 14) * 0.55}
          height={20}
          rx="2"
          fill="#1a1008"
          stroke="#000"
          strokeWidth="1"
        />
      ))}

      {/* Piano legs */}
      <rect x="25" y="120" width="12" height="10" rx="2" fill="#1a1008"/>
      <rect x="283" y="120" width="12" height="10" rx="2" fill="#1a1008"/>

      {/* Music stand on top */}
      <rect x="100" y="14" width="70" height="36" rx="3" fill="#3b2209" stroke="#000" strokeWidth="2"/>
      <rect x="130" y="14" width="3" height="36" fill="#5a3310"/>
      {/* Music lines on stand */}
      <line x1="108" y1="22" x2="162" y2="22" stroke="#c8a97a" strokeWidth="1.5"/>
      <line x1="108" y1="28" x2="162" y2="28" stroke="#c8a97a" strokeWidth="1.5"/>
      <line x1="108" y1="34" x2="162" y2="34" stroke="#c8a97a" strokeWidth="1.5"/>
      <line x1="108" y1="40" x2="162" y2="40" stroke="#c8a97a" strokeWidth="1.5"/>

      {/* Shine on lid */}
      <ellipse cx="190" cy="28" rx="40" ry="6" fill="white" opacity="0.08" transform="rotate(-10 190 28)"/>
    </svg>
  );
}

interface RoomCellProps {
  peerId: string;
  displayName?: string;
  avatarIndex?: number;
  isMuted?: boolean;
  isCameraOff?: boolean;
  stream?: MediaStream | null;
  isEmpty?: boolean;
  isLocal?: boolean;
}

export function RoomCell({
  displayName,
  avatarIndex = 0,
  isMuted = false,
  isCameraOff = false,
  stream,
  isEmpty = false,
  isLocal = false
}: RoomCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (isEmpty) {
    return (
      <div className="relative flex flex-col items-center justify-end w-full h-full min-h-[250px] bg-wood-light border-8 border-wood-dark rounded-2xl overflow-hidden cartoon-shadow p-4 opacity-80">
        <div className="absolute inset-0 bg-wallpaper-pattern opacity-50 z-0"></div>
        <div className="relative z-10 flex flex-col items-center">
          <img 
            src={`${import.meta.env.BASE_URL}images/sleeping-cat.png`} 
            alt="Sleeping cat" 
            className="w-24 h-24 object-contain opacity-70 mb-8"
          />
          <div className="bg-card text-card-foreground px-4 py-1 rounded-full font-bold border-2 border-foreground text-sm rotate-3">
            For Rent
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative flex flex-col items-center justify-between w-full h-full min-h-[360px] sm:min-h-[420px] border-8 rounded-2xl overflow-hidden cartoon-shadow p-2 pt-6 transition-all duration-300",
      isLocal ? "border-primary bg-primary/10" : "border-wood-dark bg-wood-light"
    )}>
      {/* Wall Texture */}
      <div className="absolute inset-0 bg-wallpaper-pattern opacity-60 z-0"></div>
      
      {/* Video & Avatar Container */}
      <div className="relative z-10 flex flex-col items-center flex-1 w-full mt-2">
        {/* Webcam Oval */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-4">
          <div className={cn(
            "w-full h-full rounded-full border-4 border-foreground overflow-hidden bg-background cartoon-shadow-hover",
            !isMuted && stream && "animate-pulse-ring" // Show pulse if they might be practicing
          )}>
            {isCameraOff || !stream ? (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <img 
                  src={`${import.meta.env.BASE_URL}images/avatar-${avatarIndex}.png`} 
                  alt="Avatar placeholder"
                  className="w-3/4 h-3/4 object-contain opacity-50 grayscale"
                />
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal} // Always mute local video playback to avoid feedback
                className={cn(
                  "w-full h-full object-cover",
                  isLocal && "scale-x-[-1]" // Mirror local video
                )}
              />
            )}
          </div>

          {/* Status Badges */}
          <div className="absolute -bottom-2 -right-2 flex gap-1">
            {isMuted && (
              <div className="bg-card p-1.5 rounded-full border-2 border-foreground shadow-sm z-20 flex items-center justify-center" title="Muted">
                <span className="text-sm">🤫</span>
              </div>
            )}
            {isCameraOff && (
              <div className="bg-card p-1.5 rounded-full border-2 border-foreground shadow-sm z-20 flex items-center justify-center text-muted-foreground" title="Camera Off">
                <VideoOff size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Small Avatar sitting at piano */}
        <div className="absolute bottom-2 z-20 w-16 h-16 sm:w-20 sm:h-20 drop-shadow-md">
           <img 
              src={`${import.meta.env.BASE_URL}images/avatar-${avatarIndex}.png`} 
              alt={displayName}
              className={cn("w-full h-full object-contain", !isMuted && "animate-bounce-subtle")}
            />
        </div>
      </div>

      {/* Piano illustration at bottom */}
      <div className="relative w-[120%] -mx-4 -mb-2 z-30 flex flex-col items-center">
        <PianoSVG />
        {/* Name tag on the piano */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-3 py-1 rounded-lg border-2 border-foreground font-bold text-xs sm:text-sm whitespace-nowrap z-40 cartoon-shadow shadow-sm">
          {displayName}
          {isLocal && " (You)"}
        </div>
      </div>
    </div>
  );
}
