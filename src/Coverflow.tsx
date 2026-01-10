import { useRef, useEffect, KeyboardEvent, PointerEvent } from 'react';
import './styles.scss';

// --- Interfaces ---
export interface AlbumItem {
  image_url: string;
  title: string;
  artists: string;
  position?: number;
}

interface CoverflowProps {
  items: AlbumItem[];
  imgWidth?: number;
  imgHeight?: number;
}

interface DragState {
  isDown: boolean;
  startX: number;
  scrollLeft: number;
  hasMoved?: boolean;
  lastX: number;
  lastT: number;
  velocity: number;
}

// --- Constants & Helpers ---
const OVERLAP_FACTOR = 0.8;
const DRAG_THRESHOLD = 10;
const MOMENTUM_MULTIPLIER = 200;

// Easing Functions
const easeInQuad = (t: number) => t * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type EasingFunction = (t: number) => number;

function Coverflow({ items = [], imgWidth = 200, imgHeight = 200 }: CoverflowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLUListElement>(null);
  
  // Initialize drag state with defaults
  const dragRef = useRef<DragState>({ 
    isDown: false, 
    startX: 0, 
    scrollLeft: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0
  });
  
  const scrollRafRef = useRef<number | null>(null);

  // Add buffer to ensure last items are reachable despite negative margins
  useEffect(() => {
    if (cardsRef.current) {
      // Logic: standard center padding + extra buffer for negative margins
      const centerPad = `calc(50% - ${imgWidth / 2}px)`;
      cardsRef.current.style.paddingLeft = centerPad;
      cardsRef.current.style.paddingRight = '0px'; 
      
      // Calculate explicit width to force scrollability
      const itemStep = imgWidth * OVERLAP_FACTOR;
      const totalWidth = items.length * itemStep;
      const buffer = imgWidth * 3; // Safety buffer
      
      cardsRef.current.style.width = `${totalWidth + buffer}px`;
    }
  }, [imgWidth, items.length]);

  const stopActiveScroll = () => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  };

  const smoothScrollTo = (target: number, duration: number = 600, easingFn: EasingFunction = easeOutCubic) => {
    if (!containerRef.current) return;

    stopActiveScroll();
    const element = containerRef.current;
    const start = element.scrollLeft;
    const change = target - start;
    const startTime = performance.now();
    
    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFn(progress);
      
      element.scrollLeft = start + (change * easedProgress);

      if (elapsed < duration) {
        scrollRafRef.current = requestAnimationFrame(animateScroll);
      } else {
        scrollRafRef.current = null;
      }
    };

    scrollRafRef.current = requestAnimationFrame(animateScroll);
  };

  const getScrollStep = () => imgWidth * OVERLAP_FACTOR;

  const scrollNext = () => {
    if (containerRef.current) {
      const current = containerRef.current.scrollLeft;
      smoothScrollTo(current + imgWidth);
    }
  };

  const scrollPrev = () => {
    if (containerRef.current) {
      const current = containerRef.current.scrollLeft;
      smoothScrollTo(current - imgWidth);
    }
  };

  const handleCardClick = (index: number) => {
    if (dragRef.current.hasMoved) return; 

    // Calculate target position based on index and overlap factor
    const step = getScrollStep();
    const targetScroll = index * step;
    
    // "Simple easeIn" per user request: t^2
    smoothScrollTo(targetScroll, 600, easeInQuad);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') scrollPrev();
    if (e.key === 'ArrowRight') scrollNext();
  };

  // --- Pointer Events for Dragging ---

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    stopActiveScroll();
    
    const state = dragRef.current;
    state.isDown = true;
    state.startX = e.pageX;
    state.scrollLeft = containerRef.current.scrollLeft;
    state.hasMoved = false;
    state.lastX = e.pageX;
    state.lastT = performance.now();
    state.velocity = 0;
    
    containerRef.current.classList.add('dragging');
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state.isDown || !containerRef.current) return;
    
    e.preventDefault();
    
    const now = performance.now();
    const x = e.pageX;
    const dt = now - state.lastT;
    
    // Calculate velocity (px/ms)
    if (dt > 10) {
      const dx = x - state.lastX;
      state.velocity = dx / dt;
      state.lastX = x;
      state.lastT = now;
    }

    const totalDx = x - state.startX;
    if (Math.abs(totalDx) > DRAG_THRESHOLD) state.hasMoved = true;
    
    containerRef.current.scrollLeft = state.scrollLeft - totalDx;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state.isDown || !containerRef.current) return;
    
    state.isDown = false;
    containerRef.current.classList.remove('dragging');
    containerRef.current.releasePointerCapture(e.pointerId);

    if (!state.hasMoved) {
      // Handle Click Simulation here since PointerCapture might swallow onClick
      // Because of setPointerCapture, e.target is the container, not the element under cursor
      const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
      const card = actualTarget?.closest('.card') as HTMLElement | null;
      
      if (card && card.dataset.index) {
        const index = parseInt(card.dataset.index, 10);
        if (!isNaN(index)) {
           handleCardClick(index);
           return;
        }
      }
      return;
    }

    const { velocity } = state;
    const step = getScrollStep();
    
    // Default to nearest snap if no momentum
    let target = containerRef.current.scrollLeft;
    let duration = 500;

    if (Math.abs(velocity) > 0.1) {
       // Momentum logic
       const projected = containerRef.current.scrollLeft - (velocity * MOMENTUM_MULTIPLIER);
       target = Math.round(projected / step) * step;
       
       // Calculate duration based on distance to feel natural
       const distance = Math.abs(target - containerRef.current.scrollLeft);
       duration = Math.min(1500, Math.max(800, distance * 1.5));
    } else {
       // Snap to nearest if just dropped
       target = Math.round(target / step) * step;
    }

    smoothScrollTo(target, duration, easeOutCubic);
  };

  return (
    <div>
      <div
        className="cards-wrapper"
        ref={containerRef}
        style={{ '--cover-size': `${imgWidth}px` } as React.CSSProperties}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <ul className="cards" ref={cardsRef}>
          {items.map((album, index) => (
            <li
              key={album.position || index}
              className="card"
              data-index={index}
            >
              <img
                draggable={false}
                src={album.image_url}
                alt={`${album.title} by ${album.artists}`}
                width={imgWidth}
                height={imgHeight}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="carousel-controls">
        <button aria-label="Previous" className="carousel-btn prev" onClick={scrollPrev}>←</button>
        <button aria-label="Next" className="carousel-btn next" onClick={scrollNext}>→</button>
      </div>
    </div>
  );
}

export default Coverflow;
