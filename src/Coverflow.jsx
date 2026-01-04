import { useRef, useCallback, useEffect } from 'react';
import './styles.css'; // Import the base styles

function Coverflow({ items = [], imgWidth = 200, imgHeight = 200, overlapRatio = 0.1 }) { // Accept items prop (array of album objects)
  const containerRef = useRef(null);
  // layoutRef stores computed analytical layout values so we don't need
  // to query DOM offsets for every calculation. It is set from the
  // ResizeObserver effect.
  const layoutRef = useRef({ basePad: 0, step: 0, W: imgWidth, N: items.length });
  const pointerData = useRef({ isDown: false, startX: 0, startScrollLeft: 0, hasMoved: false, pointerType: null, history: [] });
  const scrollAnimRef = useRef({ rafId: null });
  const lastLoggedIndexRef = useRef(-1);

  // Note:
  // - Dragging on the `.cards` container disables scroll-snap temporarily to
  //   provide a "drag-free" feel (class `dragging`), then re-enables snapping
  //   shortly after pointerup so buttons and click-to-center still align items.
  // - Clicking a card centers it (clicks that are actually drags are ignored).

  // Data is provided via `items` prop; parent should import/fetch JSON.

  // (navigation handled externally) — card clicks center the card

  const getCardScrollLeft = useCallback((index) => {
    const container = containerRef.current;
    if (!container) return 0;
    const layout = layoutRef.current;
    // If we have analytical layout values, compute target directly.
    if (layout && layout.step > 0) {
      const cardCenter = layout.basePad + index * layout.step + layout.W / 2;
      const target = cardCenter - container.clientWidth / 2;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      return Math.max(0, Math.min(target, maxScroll));
    }
    // Fallback: try to measure DOM (should be rare)
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return 0;
    const card = cardsList.children[index];
    if (!card) return 0;
    const cardCenter = card.offsetLeft + card.clientWidth / 2;
    const target = cardCenter - container.clientWidth / 2;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    return Math.max(0, Math.min(target, maxScroll));
  }, []);

  // Smooth scroll helper (cancelable). Uses requestAnimationFrame for consistent easing.
  const smoothScrollTo = useCallback((element, target, duration = 400) => {
    if (!element) return;
    // cancel any running animation
    if (scrollAnimRef.current.rafId) {
      cancelAnimationFrame(scrollAnimRef.current.rafId);
      scrollAnimRef.current.rafId = null;
    }
    const start = element.scrollLeft;
    const change = target - start;
    if (change === 0) return;
    const startTime = performance.now();

    const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOutQuad(progress);
      element.scrollLeft = Math.round(start + change * eased);
      if (progress < 1) {
        scrollAnimRef.current.rafId = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current.rafId = null;
        element.scrollLeft = Math.round(target);
      }
    };

    scrollAnimRef.current.rafId = requestAnimationFrame(step);
  }, []);

  const centerCard = useCallback((index) => {
    const container = containerRef.current;
    if (!container) return;
    const scrollLeft = getCardScrollLeft(index);
    const distance = Math.abs(container.scrollLeft - scrollLeft);
    const duration = Math.min(700, Math.max(180, Math.round(distance / 1.5)));
    // Update lastLoggedIndexRef so UI/logs reflect intent immediately
    lastLoggedIndexRef.current = index;
    smoothScrollTo(container, scrollLeft, duration);
  }, [getCardScrollLeft, smoothScrollTo]);

  const getCenteredIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 0;
    const layout = layoutRef.current;
    const centerPos = container.scrollLeft + container.clientWidth / 2;
    // If we have analytical layout values, compute index arithmetically
    if (layout && layout.step > 0) {
      const approx = Math.round((centerPos - layout.basePad - layout.W / 2) / layout.step);
      const clamped = Math.max(0, Math.min(layout.N - 1, approx));
      // If near max scroll, prefer last index for user intent
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const EPS = 2;
      if (container.scrollLeft >= (maxScroll - EPS)) return layout.N - 1;
      return clamped;
    }
    // Fallback: measure DOM if layoutRef isn't ready
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return 0;
    let closest = 0;
    let minDist = Infinity;
    Array.from(cardsList.children).forEach((child, i) => {
      const childCenter = child.offsetLeft + (child.clientWidth / 2);
      const dist = Math.abs(childCenter - centerPos);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  }, []); 

  // Log centered item on scroll when it changes
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
    const next = Math.min(items.length - 1, idx + 1);
    centerCard(next);
  }, [items.length, centerCard, getCenteredIndex]);

  const scrollPrev = useCallback(() => {
    const idx = getCenteredIndex();
    const prev = Math.max(0, idx - 1);
    centerCard(prev);
  }, [centerCard, getCenteredIndex]);

  // Pointer handlers to emulate a "drag-free" experience:
  const onPointerDown = (e) => {
    pointerData.current.isDown = true;
    pointerData.current.pointerType = e.pointerType || 'mouse';
    pointerData.current.startX = e.clientX;
    pointerData.current.startScrollLeft = containerRef.current ? containerRef.current.scrollLeft : 0;
    pointerData.current.hasMoved = false;
    pointerData.current.history = [];
    // store initial history entry
    const container = containerRef.current;
    if (container) {
      container.classList.add('dragging');
      pointerData.current.history.push({ t: performance.now(), scrollLeft: container.scrollLeft });
    }
  };

  const onPointerMove = (e) => {
    if (!pointerData.current.isDown) return;
    const dx = e.clientX - pointerData.current.startX;
    if (Math.abs(dx) > 5) {
      pointerData.current.hasMoved = true;
    }
    const container = containerRef.current;
    if (!container) return;
    // record history of scroll positions for velocity calculation (milliseconds)
    const now = performance.now();
    // limit history to last 6 entries
    pointerData.current.history.push({ t: now, scrollLeft: container.scrollLeft });
    if (pointerData.current.history.length > 6) pointerData.current.history.shift();
    // If mouse, emulate drag-to-scroll for direct manipulation
    if (pointerData.current.pointerType === 'mouse') {
      container.scrollLeft = pointerData.current.startScrollLeft - dx;
      e.preventDefault?.();
    }
  };

  const onPointerUp = (e) => {
    pointerData.current.isDown = false;
    const container = containerRef.current;
    // compute velocity from history
    let velocity = 0; // px per ms
    const h = pointerData.current.history;
    if (h.length >= 2) {
      const a = h[h.length - 2];
      const b = h[h.length - 1];
      const dt = b.t - a.t || 1;
      velocity = (b.scrollLeft - a.scrollLeft) / dt;
    }
    pointerData.current.pointerType = null;

    if (container) {
      // remove dragging class after a tick
      setTimeout(() => {
        container.classList.remove('dragging');
        // If velocity is significant (fast swipe), calculate a momentum target
        const absV = Math.abs(velocity);
            if (absV > 0.25) {
              // momentum distance in ms to project (tweakable)
              // reduce projection time so momentum isn't excessive
              const momentumMs = 220;
              const projected = container.scrollLeft + velocity * momentumMs;
          // find nearest card to projected scroll position
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
            centerCard(bestIdx);
            return;
          }
        }
        // otherwise just snap to nearest card
        setTimeout(() => centerCard(getCenteredIndex()), 120);
      }, 100);
    }
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

  // Modernize: set CSS `--cover-size` from `imgWidth` and compute symmetric
  // left/right padding using ResizeObserver so first/last cards can center.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cardsList = container.querySelector('.cards');
    if (!cardsList) return;

    // set CSS var so CSS and JS sizing stay in sync
    container.style.setProperty('--cover-size', `${imgWidth}px`);

    const computePadding = () => {
      const N = items.length;
      const W = imgWidth;
      const m = Math.round(overlapRatio * W);
      if (N === 0) return;
      // Base symmetric padding: half container minus half card width
      const basePad = Math.max(0, Math.round(container.clientWidth / 2 - W / 2));

      // Compute items' total laid-out width analytically:
      // itemsWidth = W + (N-1) * (W - 2*m)
      const itemsWidth = W + Math.max(0, (N - 1) * (W - 2 * m));

      // Expected scrollWidth with symmetric base padding on both sides
      const expectedScrollWidth = basePad + itemsWidth + basePad;

      // Required scrollWidth so last card center can reach container center
      // lastOffsetLeft = basePad + (N-1) * (W - 2*m)
      const lastOffsetLeft = basePad + Math.max(0, (N - 1) * (W - 2 * m));
      const lastCenter = lastOffsetLeft + W / 2;
      const requiredScrollWidth = Math.ceil(lastCenter + container.clientWidth / 2);

      const extra = Math.max(0, requiredScrollWidth - expectedScrollWidth);
      // Experimental: add extra room equal to 3 items to allow final items to center
      const experimentalExtraItems = 2 * 220;
      const experimentalExtraWidth = experimentalExtraItems * Math.max(0, (W - 2 * m));
      const totalRight = basePad + extra + experimentalExtraWidth;
      // Debug log to inspect computed values during the experiment
       
      console.log('Coverflow: computePadding', { N, W, m, basePad, itemsWidth, expectedScrollWidth, requiredScrollWidth, extra, experimentalExtraItems, experimentalExtraWidth, totalRight });

      cardsList.style.paddingLeft = basePad + 'px';
      cardsList.style.paddingRight = totalRight + 'px';
      // Store analytical layout values for fast calculations elsewhere
      layoutRef.current = { basePad, step: Math.max(1, (W - 2 * m)), W, N };
    };

    // ResizeObserver reacts to layout changes more reliably than timeouts
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => computePadding());
      ro.observe(container);
      ro.observe(cardsList);
    }
    // run once immediately
    computePadding();
    const onResize = () => computePadding();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [imgWidth, items]);

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
              // ignore clicks that are actually drags
              if (pointerData.current.hasMoved) {
                pointerData.current.hasMoved = false;
                return;
              }
              centerCard(index);
            }}
          /* onClick={() => handleCardClick(album.some_url)} // Add URL if available in data */>
            <img
              draggable={false}
              src={album.image_url}
              alt={`${album.title} by ${album.artists}`}
              width={imgWidth}
              height={imgHeight}
            />
            {/* Add title/artist info if needed */}
            {/* <p>{album.title}</p> */}
            {/* <p>{album.artists}</p> */}
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
