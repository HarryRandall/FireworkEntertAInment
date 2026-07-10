'use client';

/**
 * TemplateLikeButton - authenticated heart toggle for published Explore shows.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleShowPresetLikeAction } from '@/app/actions/show-preset-likes';
import { toast } from '@/app/components/ui';

export function TemplateLikeButton({
  templateId,
  templateSlug,
  initialCount,
  initialLiked,
}: {
  templateId: string;
  templateSlug: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function toggleLike() {
    startTransition(async () => {
      const result = await toggleShowPresetLikeAction({ presetId: templateId, slug: templateSlug });
      if (!result.ok) {
        if (result.requiresAuth) {
          router.push(`/login?next=${encodeURIComponent(`/library/${templateSlug}`)}`);
          return;
        }
        toast.error(result.error);
        return;
      }
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    });
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={isPending}
      aria-pressed={liked}
      aria-label={liked ? 'Remove show from saved shows' : 'Save show'}
      className="focus-glow-action border-border/70 bg-background/70 text-on-surface-variant hover:border-destructive/35 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-all focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      <Heart
        size={16}
        className={liked ? 'fill-destructive text-destructive' : 'text-destructive'}
      />
      {likeCount.toLocaleString('en-AU')}
    </button>
  );
}
