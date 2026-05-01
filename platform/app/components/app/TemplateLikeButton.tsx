"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

export function TemplateLikeButton({
  templateSlug,
  initialCount,
}: {
  templateSlug: string;
  initialCount: number;
}) {
  const storageKey = `showcrafter:template-like:${templateSlug}`;
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLiked(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function toggleLike() {
    setLiked((current) => {
      const next = !current;
      if (next) window.localStorage.setItem(storageKey, "1");
      else window.localStorage.removeItem(storageKey);
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-outline/20 px-5 text-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container-highest/60 hover:text-primary active:scale-[0.98]"
    >
      <Heart
        size={17}
        className={liked ? "fill-primary text-primary" : "text-primary"}
      />
      {initialCount + (liked ? 1 : 0)}
    </button>
  );
}
