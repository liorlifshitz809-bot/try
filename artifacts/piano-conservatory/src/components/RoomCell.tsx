import { useEffect, useRef } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function PianoSVG({ lidOpen = true }: { lidOpen?: boolean }) {
  return (
    <svg viewBox="0 0 320 130" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-label="Piano">
      <rect x="10" y="50" width="300" height="72" rx="6" ry="6" fill="#1a1008" stroke="#000" strokeWidth="3"/>
      <rect x="10" y="50" width="300" height="14" rx="0" fill="#2a1a0c" stroke="#000" strokeWidth="2"/>
      {lidOpen ? (
        <>
          <polygon points="10,50 310,50 250,8 70,8" fill="#2a1a0c" stroke="#000" strokeWidth="3"/>
          <line x1="230" y1="12" x2="240" y2="50" stroke="#6b4226" strokeWidth="3" strokeLinecap="round"/>
          <rect x="100" y="14" width="70" height="36" rx="3" fill="#3b2209" stroke="#000" strokeWidth="2"/>
          <rect x="130" y="14" width="3" height="36" fill="#5a3310"/>
          <line x1="108" y1="22" x2="162" y2="22" stroke="#c8a97a" strokeWidth="1.5"/>
          <line x1="108" y1="28" x2="162" y2="28" stroke="#c8a97a" strokeWidth="1.5"/>
          <line x1="108" y1="34" x2="162" y2="34" stroke="#c8a97a" strokeWidth="1.5"/>
          <line x1="108" y1="40" x2="162" y2="40" stroke="#c8a97a" strokeWidth="1.5"/>
          <ellipse cx="190" cy="28" rx="40" ry="6" fill="white" opacity="0.08" transform="rotate(-10 190 28)"/>
        </>
      ) : (
        <>
          <rect x="10" y="38" width="300" height="14" rx="4" ry="4" fill="#2a1a0c" stroke="#000" strokeWidth="3"/>
          <ellipse cx="160" cy="44" rx="80" ry="4" fill="white" opacity="0.05"/>
        </>
      )}
      <rect x="15" y="86" width="290" height="32" rx="4" fill="#f5f0e8" stroke="#000" strokeWidth="2"/>
      {Array.from({ length: 14 }).map((_, i) => (
        <rect key={`wk-${i}`} x={15 + i * (290 / 14)} y={86} width={290 / 14 - 2} height={32} rx="2" fill="#fffef5" stroke="#ccc" strokeWidth="1"/>
      ))}
      {[1, 2, 4, 5, 6, 8, 9, 11, 12, 13].map((pos) => (
        <rect key={`bk-${pos}`} x={15 + pos * (290 / 14) - (290 / 14) * 0.3} y={86} width={(290 / 14) * 0.55} height={20} rx="2" fill="#1a1008" stroke="#000" strokeWidth="1"/>
      ))}
      <rect x="25" y="120" width="12" height="10" rx="2" fill="#1a1008"/>
      <rect x="283" y="120" width="12" height="10" rx="2" fill="#1a1008"/>
    </svg>
  );
}

const isEmojiOnly = (text: string) => {
  const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u;
  return emojiRegex.test(text) && text.trim().length <= 4;
};

interface RoomCellProps {
  peerId: string;
  displayName?: string;
  avatarIndex?: number;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isLidOpen?: boolean;
  stream?: MediaStream | null;
  isEmpty?: boolean;
  isLocal?: boolean;
  reaction?: string;
}

export function RoomCell({
  displayName,
  avatarIndex = 0,
  isMuted = false,
  isCameraOff = false,
  isLidOpen = false,
  stream,
  isEmpty = false,
  isLocal = false,
  reaction,
}: RoomCellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Always keep the video element in the DOM — toggling srcObject only once when stream arrives.
  // Conditional rendering caused the srcObject to be lost on remount (stream ref doesn't change
  // so the effect never re-runs on the new element), which caused the blank white screen bug.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const cameraOff = isCameraOff || !stream;

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
      "relative flex flex-col items-center justify-between w-full h-full min-h-[360px] sm:min-h-[420px] border-8 rounded-2xl overflow-hidden cartoon-shadow transition-all duration-300",
      isLocal ? "border-primary bg-primary/10" : "border-wood-dark bg-wood-light",
      isLidOpen && "ring-4 ring-green-400 ring-offset-2"
    )}>
      {/* Wall Texture */}
      <div className="absolute inset-0 bg-wallpaper-pattern opacity-60 z-0"></div>

      {/* Lid status badge */}
      {isLidOpen && (
        <div className="absolute top-2 right-2 z-30 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-green-700 shadow">
          🎹 Practicing
        </div>
      )}

      {/* Status badges (top-left) */}
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
        {isMuted && (
          <div className="bg-card p-1.5 rounded-full border-2 border-foreground shadow-sm flex items-center justify-center" title="Muted">
            <span className="text-sm">🤫</span>
          </div>
        )}
        {cameraOff && (
          <div className="bg-card p-1.5 rounded-full border-2 border-foreground shadow-sm flex items-center justify-center text-muted-foreground" title="Camera Off">
            <VideoOff size={14} />
          </div>
        )}
      </div>

      {/* Reaction bubble */}
      <AnimatePresence mode="wait">
        {reaction && (
          <motion.div
            key={reaction}
            initial={{ scale: 0, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn(
              "absolute top-10 left-1/2 -translate-x-1/2 z-40 bg-white border-2 border-foreground rounded-2xl shadow-lg px-3 py-2 max-w-[85%]",
              isEmojiOnly(reaction) ? "text-3xl" : "text-sm font-bold"
            )}
            dir="rtl"
            style={{ textAlign: 'center' }}
          >
            {reaction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video area — fills the full space above the piano. Always in DOM to preserve srcObject. */}
      <div className="relative z-10 flex-1 w-full overflow-hidden">
        {/* Live video — always rendered, hidden via opacity when camera off */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            isLocal && "scale-x-[-1]",
            cameraOff ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Avatar shown when camera is off — overlaid on the video area */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
          cameraOff ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <img
            src={`${import.meta.env.BASE_URL}images/avatar-${avatarIndex}.png`}
            alt={displayName}
            className="w-3/4 h-3/4 object-contain drop-shadow-lg"
          />
        </div>

        {/* Small avatar sitting at piano — visible only when camera is on */}
        {!cameraOff && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-14 h-14 sm:w-18 sm:h-18 drop-shadow-md">
            <img
              src={`${import.meta.env.BASE_URL}images/avatar-${avatarIndex}.png`}
              alt={displayName}
              className={cn("w-full h-full object-contain", isLidOpen && "animate-bounce-subtle")}
            />
          </div>
        )}
      </div>

      {/* Piano at bottom */}
      <div className="relative w-[115%] z-30 flex flex-col items-center -mb-1">
        <motion.div
          className="w-full"
          animate={{ scaleY: isLidOpen ? 1 : 0.97 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <PianoSVG lidOpen={isLidOpen} />
        </motion.div>

        {/* Break message when lid closed */}
        {!isLidOpen && displayName && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 bg-amber-100 border-2 border-amber-600 text-amber-900 text-xs font-bold px-3 py-1 rounded-full z-40 whitespace-nowrap shadow"
            dir="rtl"
          >
            יצאתי להפסקה אשוב בקרוב
          </div>
        )}

        {/* Name tag */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-3 py-1 rounded-lg border-2 border-foreground font-bold text-xs sm:text-sm whitespace-nowrap z-40 cartoon-shadow shadow-sm">
          {displayName}
          {isLocal && ' (You)'}
        </div>
      </div>
    </div>
  );
}
