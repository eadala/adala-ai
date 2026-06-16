/**
 * useScrollLock — Body scroll lock with proper cleanup
 *
 * Prevents body scroll when active (modals, image viewers, drawers).
 * Restores scroll position on cleanup — no freeze after close.
 *
 * Usage:
 *   useScrollLock(isOpen);         // auto lock/unlock
 *   const { lock, unlock } = useScrollLock(); // manual
 */
import { useEffect, useCallback, useRef } from "react";

export function useScrollLock(active?: boolean) {
  const scrollY = useRef(0);
  const locked  = useRef(false);

  const lock = useCallback(() => {
    if (locked.current) return;
    scrollY.current = window.scrollY;
    document.body.style.overflow  = "hidden";
    document.body.style.position  = "fixed";
    document.body.style.top       = `-${scrollY.current}px`;
    document.body.style.width     = "100%";
    locked.current = true;
  }, []);

  const unlock = useCallback(() => {
    if (!locked.current) return;
    document.body.style.overflow  = "";
    document.body.style.position  = "";
    document.body.style.top       = "";
    document.body.style.width     = "";
    window.scrollTo(0, scrollY.current);
    locked.current = false;
  }, []);

  /* Auto mode — track active prop */
  useEffect(() => {
    if (active === undefined) return;
    if (active) lock();
    else        unlock();
    return unlock;
  }, [active, lock, unlock]);

  /* Cleanup on unmount */
  useEffect(() => () => unlock(), [unlock]);

  return { lock, unlock };
}
