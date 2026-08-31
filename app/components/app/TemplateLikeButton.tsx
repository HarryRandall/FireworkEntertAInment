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
    const previousLiked = liked;
    const previousCount = likeCount;
    const optimisticLiked = !previousLiked;
    setLiked(optimisticLiked);
    setLikeCount(Math.max(0, previousCount + (optimisticLiked ? 1 : -1)));

    startTransition(async () => {
      try {
        const result = await toggleShowPresetLikeAction({
          presetId: templateId,
          slug: templateSlug,
        });
        if (!result.ok) {
          setLiked(previousLiked);
          setLikeCount(previousCount);
          if (result.requiresAuth) {
            router.push(`/login?next=${encodeURIComponent(`/library/${templateSlug}`)}`);
            return;
          }
          toast.error(result.error);
          return;
        }
        setLiked(result.liked);
        setLikeCount(result.likeCount);
      } catch (error) {
        setLiked(previousLiked);
        setLikeCount(previousCount);
        console.error('[TemplateLikeButton] toggle failed:', error);
        toast.error('This template could not be saved. Please try again.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggleLike}
      disabled={isPending}
      aria-busy={isPending}
      aria-pressed={liked}
      aria-label={`${liked ? 'Remove template from saved shows' : 'Save template'}, ${likeCount.toLocaleString('en-AU')} ${likeCount === 1 ? 'save' : 'saves'}`}
      className="focus-glow-action border-border/70 bg-background/70 text-on-surface-variant hover:border-destructive/35 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-[border-color,transform] focus:outline-none focus-visible:outline-none active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      <Heart
        aria-hidden="true"
        size={16}
        className={liked ? 'fill-destructive text-destructive' : 'text-destructive'}
      />
      {likeCount.toLocaleString('en-AU')}
    </button>
  );
}
