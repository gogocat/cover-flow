import { useRef, useEffect } from 'react';
import './styles.scss';



function Coverflow({ items = [], imgWidth = 200, imgHeight = 200 }) {
  const containerRef = useRef(null);
  const cardsRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const scrollRafRef = useRef(null);

  // Add buffer to ensure last items are reachable despite negative margins
  useEffect(() => {
    if (cardsRef.current) {
      // Logic: standard center padding + extra buffer for negative margins
      // 50% - size/2 centers the item. 
      const centerPad = `calc(50% - ${imgWidth / 2}px)`;
      cardsRef.current.style.paddingLeft = centerPad;
      cardsRef.current.style.paddingRight = '0px'; 
      
      // Calculate explicit width to force scrollability
      // Effective step is roughly 0.8 * imgWidth due to overlap
      const itemStep = imgWidth * 0.8;
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

  const smoothScrollTo = (element, target, duration = 600, easingFn) => {
    stopActiveScroll();
    const start = element.scrollLeft;
    const change = target - start;
    const startTime = performance.now();
    
    // Default to easeOutCubic for natural momentum/snap
    const defaultEase = (t) => 1 - Math.pow(1 - t, 3);
    const ease = easingFn || defaultEase;

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = ease(progress);
      
      element.scrollLeft = start + (change * easedProgress);

      if (elapsed < duration) {
        scrollRafRef.current = requestAnimationFrame(animateScroll);
      } else {
        scrollRafRef.current = null;
      }
    };

    scrollRafRef.current = requestAnimationFrame(animateScroll);
  };

  const scrollNext = () => {
    if (containerRef.current) {
        const current = containerRef.current.scrollLeft;
        smoothScrollTo(containerRef.current, current + imgWidth, 600);
    }
  };

  const scrollPrev = () => {
    if (containerRef.current) {
        const current = containerRef.current.scrollLeft;
        smoothScrollTo(containerRef.current, current - imgWidth, 600);
    }
  };

  const handleCardClick = (index) => {
    console.log('handleCardClick: ', index);
    if (dragRef.current.hasMoved) return; 

    // Calculate target position based on index and overlap factor (0.8)
    // Matches the logic used in onPointerUp snap calculation
    const step = imgWidth * 0.8;
    const targetScroll = index * step;
    
    // "Simple easeIn" per user request: t^2
    const easeInQuad = (t) => t * t;

    smoothScrollTo(containerRef.current, targetScroll, 600, easeInQuad);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') scrollPrev();
    if (e.key === 'ArrowRight') scrollNext();
  };

  // Pointer Events for Dragging
  const onPointerDown = (e) => {
    stopActiveScroll();
    dragRef.current.isDown = true;
    dragRef.current.startX = e.pageX;
    dragRef.current.scrollLeft = containerRef.current.scrollLeft;
    dragRef.current.hasMoved = false;
    dragRef.current.lastX = e.pageX;
    dragRef.current.lastT = performance.now();
    dragRef.current.velocity = 0;
    
    containerRef.current.classList.add('dragging');
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.isDown) return;
    e.preventDefault();
    
    const now = performance.now();
    const x = e.pageX;
    const dt = now - dragRef.current.lastT;
    
    // Calculate velocity (px/ms)
    if (dt > 10) {
      const dx = x - dragRef.current.lastX;
      dragRef.current.velocity = dx / dt;
      dragRef.current.lastX = x;
      dragRef.current.lastT = now;
    }

    const totalDx = x - dragRef.current.startX;
    if (Math.abs(totalDx) > 10) dragRef.current.hasMoved = true;
    
    containerRef.current.scrollLeft = dragRef.current.scrollLeft - totalDx;
  };

  const onPointerUp = (e) => {
    if (!dragRef.current.isDown) return;
    dragRef.current.isDown = false;
    containerRef.current.classList.remove('dragging');
    containerRef.current.releasePointerCapture(e.pointerId);

    if (!dragRef.current.hasMoved) {
      // Handle Click Simulation here since PointerCapture might swallow onClick
      // Because of setPointerCapture, e.target is the container, not the element under cursor
      const actualTarget = document.elementFromPoint(e.clientX, e.clientY);
      const card = actualTarget?.closest('.card');
      
      if (card) {
        const index = parseInt(card.dataset.index, 10);
        if (!isNaN(index)) {
           handleCardClick(index);
           return;
        }
      }
      return;
    }

    const { velocity } = dragRef.current;
    
    // Default to nearest snap if no momentum
    let target = containerRef.current.scrollLeft;
    let duration = 500;

    if (Math.abs(velocity) > 0.1) {
       // Momentum logic
       const momentumMultiplier = 200; 
       const projected = containerRef.current.scrollLeft - (velocity * momentumMultiplier);
       
       const step = imgWidth * 0.8; 
       target = Math.round(projected / step) * step;
       
       const distance = Math.abs(target - containerRef.current.scrollLeft);
       duration = Math.min(1500, Math.max(800, distance * 1.5));
    } else {
       // Snap to nearest if just dropped
       const step = imgWidth * 0.8;
       target = Math.round(target / step) * step;
    }

    smoothScrollTo(containerRef.current, target, duration);
  };

  return (
    <div>
      <div
        className="cards-wrapper"
        ref={containerRef}
        style={{ '--cover-size': `${imgWidth}px` }}
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
