import { useEffect, useState } from "react";

interface SplashScreenProps {
  isLoading: boolean;
}

export default function SplashScreen({ isLoading }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    if (isLoading) return;

    setPhase("fading");
    const removeTimer = setTimeout(() => setPhase("gone"), 500);
    return () => clearTimeout(removeTimer);
  }, [isLoading]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src="/logo.png"
        alt="모두모투"
        className="w-24 h-24 sm:w-28 sm:h-28 object-contain animate-splash-float"
      />
      <p
        className="mt-5 text-lg sm:text-xl font-bold text-foreground tracking-wide animate-splash-float"
        style={{ animationDelay: "0.15s" }}
      >
        모두모투
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        모의투자의 모든 것
      </p>
    </div>
  );
}
