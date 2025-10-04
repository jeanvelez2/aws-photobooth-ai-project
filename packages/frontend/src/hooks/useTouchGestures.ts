import { useRef, useCallback } from 'react';

interface TouchGestureOptions {
  onTap?: (event: TouchEvent) => void;
  onDoubleTap?: (event: TouchEvent) => void;
  onSwipeLeft?: (event: TouchEvent) => void;
  onSwipeRight?: (event: TouchEvent) => void;
  onSwipeUp?: (event: TouchEvent) => void;
  onSwipeDown?: (event: TouchEvent) => void;
  onPinch?: (scale: number, event: TouchEvent) => void;
}

export function useTouchGestures(options: TouchGestureOptions) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const initialDistanceRef = useRef<number>(0);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    // Handle pinch gesture
    if (event.touches.length === 2 && options.onPinch) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      initialDistanceRef.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    }
  }, [options.onPinch]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2 && options.onPinch && initialDistanceRef.current > 0) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      const scale = currentDistance / initialDistanceRef.current;
      options.onPinch(scale, event);
    }
  }, [options.onPinch]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Tap detection
    if (distance < 10 && deltaTime < 300) {
      const now = Date.now();
      if (now - lastTapRef.current < 300 && options.onDoubleTap) {
        options.onDoubleTap(event);
        lastTapRef.current = 0;
      } else {
        if (options.onTap) {
          options.onTap(event);
        }
        lastTapRef.current = now;
      }
    }
    // Swipe detection
    else if (distance > 50 && deltaTime < 500) {
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      if (Math.abs(angle) < 45 && options.onSwipeRight) {
        options.onSwipeRight(event);
      } else if (Math.abs(angle) > 135 && options.onSwipeLeft) {
        options.onSwipeLeft(event);
      } else if (angle > 45 && angle < 135 && options.onSwipeDown) {
        options.onSwipeDown(event);
      } else if (angle < -45 && angle > -135 && options.onSwipeUp) {
        options.onSwipeUp(event);
      }
    }

    touchStartRef.current = null;
    initialDistanceRef.current = 0;
  }, [options]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
}