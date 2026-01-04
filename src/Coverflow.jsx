import { useRef, useCallback, useEffect } from 'react';
import './styles.scss';

function Coverflow({ items = [], imgWidth = 200, imgHeight = 200, overlapRatio = 0.1 }) {
  const containerRef = useRef(null);
  const layoutRef = useRef({ basePad: 0, step: 0, W: imgWidth, N: items.length });
  const pointerRef = useRef({ isDown: false, startX: 0, startScrollLeft: 0, hasMoved: false, pointerType: null, history: [] });
  const scrollAnimRef = useRef({ rafId: null });
  const lastLoggedIndexRef = useRef(-1);

  // Helper: clamp value to range
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Compute target scrollLeft for a card index. Prefer analytical layout when available.
  const getCardScrollLeft = useCallback((index) => {
    const container = containerRef.current;
    if (!container) return 0;
    const layout = layoutRef.current;
    if (layout && layout.step > 0) {
      const cardCenter = layout.basePad + index * layout.step + layout.W / 2;
      const target = cardCenter - container.clientWidth / 2;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      return clamp(target, 0, maxScroll);
    }
    // Fallback: measure DOM
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return 0;
    const card = cardsList.children[index];
    if (!card) return 0;
    const cardCenter = card.offsetLeft + card.clientWidth / 2;
    const target = cardCenter - container.clientWidth / 2;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    return clamp(target, 0, maxScroll);
  }, []);

  // Smooth, cancelable scroll using rAF
  const smoothScrollTo = useCallback((element, target, duration = 400) => {
    if (!element) return;
    if (scrollAnimRef.current.rafId) {
      cancelAnimationFrame(scrollAnimRef.current.rafId);
      scrollAnimRef.current.rafId = null;
    }
    const start = element.scrollLeft;
    const change = target - start;
    if (change === 0) return;
    const startTime = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      element.scrollLeft = Math.round(start + change * ease(progress));
      if (progress < 1) {
        scrollAnimRef.current.rafId = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current.rafId = null;
      }
    };

    scrollAnimRef.current.rafId = requestAnimationFrame(step);
  }, []);

  const centerCard = useCallback((index) => {
    const container = containerRef.current;
    if (!container) return;
    const target = getCardScrollLeft(index);
    const distance = Math.abs(container.scrollLeft - target);
    const duration = Math.min(700, Math.max(180, Math.round(distance / 1.5)));
    lastLoggedIndexRef.current = index;
    smoothScrollTo(container, target, duration);
  }, [getCardScrollLeft, smoothScrollTo]);

  const getCenteredIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 0;
    const layout = layoutRef.current;
    const centerPos = container.scrollLeft + container.clientWidth / 2;
    if (layout && layout.step > 0) {
      const approx = Math.round((centerPos - layout.basePad - layout.W / 2) / layout.step);
      const clamped = clamp(approx, 0, Math.max(0, layout.N - 1));
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      if (container.scrollLeft >= maxScroll - 2) return layout.N - 1;
      return clamped;
    }
    // Fallback: find closest by DOM measurement
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return 0;
    let closest = 0;
    let minDist = Infinity;
    Array.from(cardsList.children).forEach((child, i) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - centerPos);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  }, []);

  // Report centered index on scroll changes
  const onScroll = useCallback(() => {
    const idx = getCenteredIndex();
    if (idx !== lastLoggedIndexRef.current) {
      lastLoggedIndexRef.current = idx;
      const container = containerRef.current;
      const scrollLeft = container ? container.scrollLeft : 0;
      const target = getCardScrollLeft(idx);
      console.log('Coverflow: centeredIndex', { idx, title: items[idx]?.title, scrollLeft, target });
    }
  }, [getCenteredIndex, getCardScrollLeft, items]);

  const scrollNext = useCallback(() => {
    const idx = getCenteredIndex();
    centerCard(Math.min(items.length - 1, idx + 1));
  }, [items.length, centerCard, getCenteredIndex]);

  const scrollPrev = useCallback(() => {
    const idx = getCenteredIndex();
    centerCard(Math.max(0, idx - 1));
  }, [centerCard, getCenteredIndex]);

  // Pointer-based dragging with momentum
  const onPointerDown = (e) => {
    const p = pointerRef.current;
    p.isDown = true;
    p.pointerType = e.pointerType || 'mouse';
    p.startX = e.clientX;
    p.startScrollLeft = containerRef.current ? containerRef.current.scrollLeft : 0;
    p.hasMoved = false;
    p.history = [];
    const container = containerRef.current;
    if (container) {
      container.classList.add('dragging');
      p.history.push({ t: performance.now(), scrollLeft: container.scrollLeft });
    }
  };

  const onPointerMove = (e) => {
    const p = pointerRef.current;
    if (!p.isDown) return;
    const dx = e.clientX - p.startX;
    if (Math.abs(dx) > 5) p.hasMoved = true;
    const container = containerRef.current;
    if (!container) return;
    const now = performance.now();
    p.history.push({ t: now, scrollLeft: container.scrollLeft });
    if (p.history.length > 6) p.history.shift();
    if (p.pointerType === 'mouse') {
      container.scrollLeft = p.startScrollLeft - dx;
      e.preventDefault?.();
    }
  };

  const onPointerUp = () => {
    const p = pointerRef.current;
    p.isDown = false;
    const container = containerRef.current;
    // If the container is missing (unmounted or not yet mounted), bail early.
    if (!container) {
      p.pointerType = null;
      return;
    }

    // compute velocity from history
    let velocity = 0;
    const h = p.history;
    if (h.length >= 2) {
      const a = h[h.length - 2];
      const b = h[h.length - 1];
      const dt = Math.max(1, b.t - a.t);
      velocity = (b.scrollLeft - a.scrollLeft) / dt;
    }
    p.pointerType = null;

    // Use rAF instead of setTimeout to allow the browser to finish the
    // pointer interaction and to perform a smooth, frame-aligned snap.
    // Reduce the momentum projection so flicks are less extreme.
    requestAnimationFrame(() => {
      container.classList.remove('dragging');
      const absV = Math.abs(velocity);
      if (absV > 0.2) {
        // smaller projection to slow down the momentum
        const momentumMs = 140;
        const projected = container.scrollLeft + velocity * momentumMs;
        const cardsList = container.querySelector('.cards');
        if (cardsList && cardsList.children.length) {
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < cardsList.children.length; i++) {
            const target = getCardScrollLeft(i);
            const d = Math.abs(target - projected);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          // center with a slightly longer duration for a slower feel
          const containerEl = container;
          const targetLeft = getCardScrollLeft(bestIdx);
          const distance = Math.abs(containerEl.scrollLeft - targetLeft);
          const duration = Math.min(800, Math.max(240, Math.round(distance / 1.2)));
          lastLoggedIndexRef.current = bestIdx;
          smoothScrollTo(containerEl, targetLeft, duration);
          return;
        }
      }
      // Snap to nearest card (use smoothScrollTo for consistent easing)
      const nearest = getCenteredIndex();
      const targetLeft = getCardScrollLeft(nearest);
      const distance = Math.abs(container.scrollLeft - targetLeft);
      const duration = Math.min(600, Math.max(200, Math.round(distance / 1.5)));
      lastLoggedIndexRef.current = nearest;
      smoothScrollTo(container, targetLeft, duration);
    });
  };

  // Cleanup any running animation on unmount
  useEffect(() => {
    const current = scrollAnimRef.current;
    return () => {
      if (current && current.rafId) {
        cancelAnimationFrame(current.rafId);
        current.rafId = null;
      }
    };
  }, []);

  // Compute layout and keep CSS var `--cover-size` in sync.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return;

    container.style.setProperty('--cover-size', `${imgWidth}px`);

    const computePadding = () => {
      const N = items.length;
      const W = imgWidth;
      const m = Math.round(overlapRatio * W);
      if (N === 0) return;
      const basePad = Math.max(0, Math.round(container.clientWidth / 2 - W / 2));
      const itemsWidth = W + Math.max(0, (N - 1) * (W - 2 * m));
      const expectedScrollWidth = basePad + itemsWidth + basePad;
      const lastOffsetLeft = basePad + Math.max(0, (N - 1) * (W - 2 * m));
      const lastCenter = lastOffsetLeft + W / 2;
      const requiredScrollWidth = Math.ceil(lastCenter + container.clientWidth / 2);
      const extra = Math.max(0, requiredScrollWidth - expectedScrollWidth);
      // Keep an experimental buffer so last cards can center nicely
      const experimentalExtraWidth = 2 * 220 * Math.max(0, (W - 2 * m));
      const totalRight = basePad + extra + experimentalExtraWidth;

      cardsList.style.paddingLeft = basePad + 'px';
      cardsList.style.paddingRight = totalRight + 'px';
      layoutRef.current = { basePad, step: Math.max(1, (W - 2 * m)), W, N };
    };

    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => computePadding());
      ro.observe(container);
      ro.observe(cardsList);
    }
    computePadding();
    const onResize = () => computePadding();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [imgWidth, items.length, overlapRatio]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') scrollPrev();
    if (e.key === 'ArrowRight') scrollNext();
  };

  return (
    <div>
      <div
        className="cards-wrapper"
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onScroll={onScroll}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <ul className="cards">
          {items.map((album, index) => (
            <li
              key={album.position || index}
              className="card"
              onClick={() => {
                if (pointerRef.current.hasMoved) {
                  pointerRef.current.hasMoved = false;
                  return;
                }
                centerCard(index);
              }}
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
