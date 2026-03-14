import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
      "relative flex flex-col items-center justify-between w-full h-full min-h-[280px] sm:min-h-[300px] border-8 rounded-2xl overflow-hidden cartoon-shadow p-2 pt-6 transition-all duration-300",
      isLocal ? "border-primary bg-primary/10" : "border-wood-dark bg-wood-light"
    )}>
      {/* Wall Texture */}
      <div className="absolute inset-0 bg-wallpaper-pattern opacity-60 z-0"></div>
      
      {/* Video & Avatar Container */}
      <div className="relative z-10 flex flex-col items-center flex-1 w-full mt-2">
        {/* Webcam Oval */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-4">
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
      <div className="relative w-[120%] h-24 sm:h-28 -mx-4 -mb-4 z-30 flex items-end">
        <img 
          src={`${import.meta.env.BASE_URL}images/piano.png`} 
          alt="Piano"
          className="w-full h-full object-cover object-top"
        />
        
        {/* Name tag on the piano */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-3 py-1 rounded-lg border-2 border-foreground font-bold text-xs sm:text-sm whitespace-nowrap z-40 cartoon-shadow shadow-sm">
          {displayName}
          {isLocal && " (You)"}
        </div>
      </div>
    </div>
  );
}
