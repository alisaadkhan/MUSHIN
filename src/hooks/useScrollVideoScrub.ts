import { useEffect, useRef } from "react";

/**
 * useScrollVideoScrub
 *
 * Drives a <video> element's currentTime based on the scroll position within
 * a container, keeping the video permanently paused (manual frame control).
 *
 * Performance characteristics:
 * - Scroll listener is passive — never blocks the compositor thread.
 * - rAF loop starts only while the user is scrolling; stops 150ms after
 *   the last scroll event, preventing wasted frames at rest.
 * - Exponential-easing ("lerp") approach avoids abrupt seeks and reduces
 *   the number of video-decoder wake-ups.
 * - Dead-zone guard (minDelta = duration / 500) prevents micro-seeks that
 *   thrash the video decoder with imperceptible frame changes.
 * - fastSeek() is preferred where available (Chromium) for non-blocking seeks.
 * - GPU compositing is maintained by never touching layout properties inside
 *   the rAF loop.
 * - All listeners and the rAF handle are cleaned up on unmount — no leaks.
 */
export function useScrollVideoScrub(
  containerRef: React.RefObject<HTMLElement>,
  videoRef: React.RefObject<HTMLVideoElement>
) {
  const targetRef      = useRef(0);
  const currentRef     = useRef(0);
  const rafRef         = useRef<number>(0);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const container = containerRef.current;
    const video     = videoRef.current;
    if (!container || !video) return;

    // Keep the video paused at all times — we control frames manually.
    const keepPaused = () => {
      if (!video.paused) video.pause();
    };
    video.addEventListener("play", keepPaused);

    const startLoop = () => {
      if (rafRef.current) return; // already running

      const tick = () => {
        if (video.readyState >= 2 && video.duration > 0) {
          const delta    = targetRef.current - currentRef.current;
          const minDelta = video.duration / 500; // dead-zone: ~0.2% of duration

          if (Math.abs(delta) > minDelta) {
            const next = currentRef.current + delta * 0.35; // lerp factor
            currentRef.current = next;

            const el = video as HTMLVideoElement & { fastSeek?: (time: number) => void };
            if (el.fastSeek) {
              el.fastSeek(next);
            } else {
              video.currentTime = next;
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      // Snap to exact target on stop to avoid drift
      if (video.readyState >= 2 && video.duration) {
        video.currentTime = targetRef.current;
        currentRef.current = targetRef.current;
      }
    };

    const onScroll = () => {
      const rect     = container.getBoundingClientRect();
      const total    = container.offsetHeight - window.innerHeight;
      const progress = Math.min(Math.max(-rect.top / total, 0), 1);

      if (video.duration) {
        targetRef.current = progress * video.duration;
      }

      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        startLoop();
      }

      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        stopLoop();
      }, 150);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("play", keepPaused);
    };
  }, [containerRef, videoRef]);
}
