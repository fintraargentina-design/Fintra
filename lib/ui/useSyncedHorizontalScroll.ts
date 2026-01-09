import { useEffect, RefObject } from 'react';

/**
 * Synchronizes horizontal scrolling across multiple elements.
 * 
 * @param refs Array of refs to the scrollable containers
 */
export function useSyncedHorizontalScroll(refs: RefObject<HTMLElement>[]) {
  useEffect(() => {
    // Guard flag to prevent infinite loops (scroll event triggering other scroll events)
    let isSyncing = false;
    let frameId: number | null = null;

    const handleScroll = (e: Event) => {
      // If we are currently syncing (triggered by code), ignore this event
      if (isSyncing) return;

      const target = e.target as HTMLElement;
      const { scrollLeft } = target;

      isSyncing = true;

      // Propagate scrollLeft to other refs
      refs.forEach((ref) => {
        if (ref.current && ref.current !== target) {
          ref.current.scrollLeft = scrollLeft;
        }
      });

      // Reset the flag in the next frame to allow future user-initiated scrolls
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    // Attach passive scroll listeners
    refs.forEach((ref) => {
      const element = ref.current;
      if (element) {
        element.addEventListener('scroll', handleScroll, { passive: true });
      }
    });

    // Cleanup listeners
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      refs.forEach((ref) => {
        const element = ref.current;
        if (element) {
          element.removeEventListener('scroll', handleScroll);
        }
      });
    };
  }, [refs]); // Re-bind if the refs array changes (parent should memoize if possible, but refs usually stable)
}
