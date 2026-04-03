// ============================================================
//  OBSYD — main.js
// ============================================================

// --- Preloader ---
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('hidden');
    setTimeout(() => {
      preloader.remove();
    }, 800);
  }
});

// --- Active nav link on scroll ---
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.classList.toggle(
            'active',
            link.getAttribute('href') === `#${entry.target.id}`
          );
        });
      }
    });
  },
  { threshold: 0.45 }
);

sections.forEach((sec) => observer.observe(sec));

// --- Hamburger toggle ---
const hamburger = document.getElementById('hamburger-btn');
const navLinksList = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  const isOpen = navLinksList.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen);
});

// Close dropdown when a link is clicked
navLinksList.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', () => {
    navLinksList.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// ============================================================
//  DUST PARTICLE SYSTEM
//  Animates floating dust motes within the overhead spotlight
//  beam. Each particle:
//    - spawns somewhere inside the beam cone
//    - drifts slowly in a random direction with sine-wave wobble
//    - its opacity is weighted by how close it is to the beam
//      centre (bright at centre-top, invisible at edges)
//    - randomly fades in / out to simulate particles entering
//      and leaving the lit shaft
// ============================================================
(function initDustParticles() {
  const canvas = document.getElementById('dust-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ── Configuration ──────────────────────────────────────────
  const PARTICLE_COUNT = 160;   // total live particles
  const BEAM_HALF_W   = 0.28;  // half-width of beam at screen centre, as fraction of vw
  const BEAM_ORIGIN_Y = -0.05; // beam apex, fraction of vh (above viewport)

  // ── Resize handler ─────────────────────────────────────────
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Particle factory ────────────────────────────────────────
  // Particles live within the conical beam shape:
  //   at y=0 (top of viewport) the beam is ~22% wide,
  //   at y=100vh it spreads to ~55% wide.
  function randomInBeam(w, h) {
    const yFrac  = Math.random();                            // 0 (top) → 1 (bottom)
    const halfW  = (0.11 + yFrac * 0.22) * w;              // taper: narrow at top
    const cx     = w * 0.5;
    const xSpan  = (Math.random() * 2 - 1) * halfW;        // ±halfW around centre
    return {
      x  : cx + xSpan,
      y  : yFrac * h,
      vx : (Math.random() - 0.5) * 0.25,   // slow horizontal drift
      vy : (Math.random() - 0.65) * 0.30,  // slight upward bias (warm air rising)
      wobbleAmp  : Math.random() * 0.4,    // sideways sine wobble amplitude
      wobbleFreq : 0.3 + Math.random() * 0.7,
      wobbleOff  : Math.random() * Math.PI * 2,
      r          : 0.4 + Math.random() * 1.2,   // radius 0.4–1.6px
      baseAlpha  : 0.15 + Math.random() * 0.55, // intrinsic brightness
      alpha      : 0,
      fadeDir    : 1,    // 1 = fading in, -1 = fading out
      fadeSpeed  : 0.002 + Math.random() * 0.006,
      age        : 0,
      lifespan   : 300 + Math.random() * 600,   // frames
    };
  }

  // Build initial pool
  const W = () => canvas.width;
  const H = () => canvas.height;
  let particles = Array.from({ length: PARTICLE_COUNT }, () => randomInBeam(W(), H()));
  // Scatter starting ages so they don't all appear at once
  particles.forEach(p => { p.age = Math.random() * p.lifespan; });

  // ── Beam intensity at a point ────────────────────────────────
  // Returns 0→1: how much "inside the beam" a given (x,y) coordinate is.
  // Uses the same conical shape as the CSS radial-gradient.
  function beamIntensity(x, y, w, h) {
    const yFrac  = y / h;
    const halfW  = (0.11 + yFrac * 0.27) * w;
    const cx     = w * 0.5;
    const dist   = Math.abs(x - cx);
    if (dist >= halfW) return 0;
    // Soft falloff from centre
    const edgeFrac = dist / halfW;
    return Math.max(0, 1 - edgeFrac * edgeFrac);
  }

  // ── Animation loop ──────────────────────────────────────────
  let t = 0;

  function tick() {
    const w = W();
    const h = H();
    ctx.clearRect(0, 0, w, h);

    particles.forEach((p, i) => {
      p.age++;

      // Age-based fade in → hold → fade out
      if (p.age < p.lifespan * 0.15) {
        p.alpha = Math.min(p.baseAlpha, p.alpha + p.fadeSpeed * 3);
      } else if (p.age > p.lifespan * 0.80) {
        p.alpha = Math.max(0, p.alpha - p.fadeSpeed * 2);
      }

      // Move
      p.x += p.vx + Math.sin(t * p.wobbleFreq + p.wobbleOff) * p.wobbleAmp * 0.12;
      p.y += p.vy;

      // Respawn when dead or drifted far outside beam
      if (p.age >= p.lifespan || p.y < -20 || p.y > h + 20) {
        particles[i] = randomInBeam(w, h);
        particles[i].age = 0;
        return;
      }

      // Weight opacity by beam intensity (dimmer toward edges)
      const bi = beamIntensity(p.x, p.y, w, h);
      if (bi <= 0) return;

      const finalAlpha = p.alpha * bi;
      if (finalAlpha < 0.004) return;

      // Draw particle as a soft glowing dot
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      grad.addColorStop(0,   `rgba(220, 228, 255, ${finalAlpha})`);
      grad.addColorStop(0.5, `rgba(200, 210, 245, ${finalAlpha * 0.5})`);
      grad.addColorStop(1,   `rgba(180, 192, 235, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    t += 0.016; // ~matches 60fps time step
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

// ============================================================
//  CHROME CURSOR LIGHT — tracks mouse position inside navbar
//  and updates CSS custom properties --mx / --my so the
//  ::before radial-gradient follows the cursor, creating a
//  moving specular highlight on the dark-chrome surface.
// ============================================================
(function initChromeLight() {
  const navbar = document.getElementById('main-nav');
  if (!navbar) return;

  let rafId = null;
  let targetX = 50;   // percentage
  let targetY = 50;
  let currentX = 50;
  let currentY = 50;
  let isHovering = false;

  // Lerp factor — lower = smoother / more inertia (chrome-like lag)
  const LERP = 0.10;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    if (!isHovering) return;

    currentX = lerp(currentX, targetX, LERP);
    currentY = lerp(currentY, targetY, LERP);

    navbar.style.setProperty('--mx', `${currentX.toFixed(2)}%`);
    navbar.style.setProperty('--my', `${currentY.toFixed(2)}%`);

    rafId = requestAnimationFrame(tick);
  }

  navbar.addEventListener('mousemove', (e) => {
    const rect = navbar.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width)  * 100;
    targetY = ((e.clientY - rect.top)  / rect.height) * 100;

    if (!isHovering) {
      isHovering = true;
      // Snap current to target on first enter to avoid sliding from center
      currentX = targetX;
      currentY = targetY;
      rafId = requestAnimationFrame(tick);
    }
  });

  navbar.addEventListener('mouseleave', () => {
    isHovering = false;
    cancelAnimationFrame(rafId);
    // Snap back vars to center (the ::before fades out via CSS opacity)
    navbar.style.setProperty('--mx', '50%');
    navbar.style.setProperty('--my', '50%');
  });
})();

// ============================================================
//  3D OBSIDIAN CUBE INTERACTION (HERO)
//  Rotates and translates the hero cube based on mouse movement.
// ============================================================
(function initCubeTracking() {
  const cubeFollower = document.getElementById('cube-follower');
  const cube = document.getElementById('obsyd-cube');
  if (!cube || !cubeFollower) return;

  let targetRotateX = -20;
  let targetRotateY = 45;
  let currentRotateX = -20;
  let currentRotateY = 45;

  let targetTransX = 0;
  let targetTransY = 0;
  let currentTransX = 0;
  let currentTransY = 0;

  const LERP = 0.06;
  let time = 0;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function tick() {
    time += 0.005;
    
    currentRotateX = lerp(currentRotateX, targetRotateX, LERP);
    currentRotateY = lerp(currentRotateY, targetRotateY, LERP);
    
    currentTransX = lerp(currentTransX, targetTransX, LERP);
    currentTransY = lerp(currentTransY, targetTransY, LERP);

    const idleRotX = Math.sin(time) * 12;
    const idleRotY = Math.cos(time * 0.8) * 15;

    const finalX = currentRotateX + idleRotX;
    const finalY = currentRotateY + idleRotY;

    cube.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;
    cubeFollower.style.transform = `translate3d(${currentTransX}px, ${currentTransY}px, 0)`;

    requestAnimationFrame(tick);
  }

  window.addEventListener('mousemove', (e) => {
    // Only track if hero section is visible roughly
    if (window.scrollY > window.innerHeight) return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const maxRotateY = 45;
    const maxRotateX = 35;

    const fracX = (e.clientX - centerX) / centerX;
    const fracY = (e.clientY - centerY) / centerY;

    targetRotateY = fracX * maxRotateY + 45; // Base is 45
    targetRotateX = -fracY * maxRotateX - 20; // Base is -20
    
    targetTransX = fracX * 60;
    targetTransY = fracY * 60;
  });

  requestAnimationFrame(tick);
})();

// ============================================================
//  SCROLL ANIMATIONS & PARTICLE TRANSITION (CUBE -> DUST)
//  Uses GSAP and ScrollTrigger to transition the Hero cube
//  into a canvas particle system on the Work section.
// ============================================================
(function initScrollAnimations() {
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  // 1. The Hero cube just stays on top. No scroll animation needed for it.
  // Instead, we animate the NEW work cube. We fade it IN as if it was formed,
  // then break it apart into particles.
  const workCubeFol = document.getElementById('work-cube-follower');
  
  // 2. Animate the Work section header and tech cards staggering in
  gsap.from('.work-header', {
    scrollTrigger: {
      trigger: '#work',
      start: 'top 75%',
    },
    y: 30,
    opacity: 0,
    duration: 1.8,
    ease: 'expo.out'
  });

  gsap.from('.tech-card', {
    scrollTrigger: {
      trigger: '.tech-grid',
      start: 'top 80%',
    },
    y: 40,
    opacity: 0,
    duration: 1.5,
    stagger: 0.15,
    ease: 'expo.out'
  });

  // 3. Canvas Particle System for the Cube Dissolve
  const canvas = document.getElementById('cube-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('work-particles-container');

  let width, height;
  function resizeCanvas() {
    width = container.clientWidth;
    height = container.clientHeight;
    // Account for high-DPI displays for sharper particles
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const PARTICLE_COUNT = 300;
  let particles = [];
  
  // Initial parameters mapping the Work Cube's visual state
  const effectParams = { progress: 0, cubeScale: 1, cubeOpacity: 1, scatterZ: 145 };

  // This timeline maps to the scroll position within the entire #work section
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#work',
      start: 'top 50%', // Start dissolving when the section is middle of screen
      end: 'bottom 80%', // Continue dissolving until near the bottom of the section
      scrub: 1.5,       // Add slight smoothing to the scrub
    }
  });

  // We split the animations up so they don't all happen perfectly synchronized.
  // We want the cube to start shedding particles early (progress), but maintain its shape longer

  // 1. the faces slowly start pulling apart
  tl.to(effectParams, {
    scatterZ: 300,
    ease: "power1.inOut",
    onUpdate: updateCubeVisuals
  }, 0); // start at time 0 of timeline

  // 2. The particles start spawning immediately and ramp up
  tl.to(effectParams, {
    progress: 1,
    ease: "linear",
  }, 0);

  // 3. The cube visually shrinks and fades, but happens more towards the END of the timeline
  tl.to(effectParams, {
    cubeScale: 0.2, // don't shrink it all the way to 0 immediately
    cubeOpacity: 0,
    ease: "power2.in", 
  }, 0.2); // start this animation slightly after the others

  function updateCubeVisuals() {
     if (workCubeFol) {
         workCubeFol.style.transform = `translate(-50%, -50%) scale(${effectParams.cubeScale})`;
         workCubeFol.style.opacity = effectParams.cubeOpacity;
         
         // Scatter the faces
         const faces = document.querySelectorAll('.work-face');
         if (faces.length) {
             faces[0].style.transform = `rotateY(0deg) translateZ(${effectParams.scatterZ}px)`;
             faces[1].style.transform = `rotateY(180deg) translateZ(${effectParams.scatterZ}px)`;
             faces[2].style.transform = `rotateY(90deg) translateZ(${effectParams.scatterZ}px)`;
             faces[3].style.transform = `rotateY(-90deg) translateZ(${effectParams.scatterZ}px)`;
             faces[4].style.transform = `rotateX(90deg) translateZ(${effectParams.scatterZ}px)`;
             faces[5].style.transform = `rotateX(-90deg) translateZ(${effectParams.scatterZ}px)`;
         }
     }
  }

  class Particle {
    constructor() {
      this.reset();
      // Start in the center of the left section where the work cube is
      this.x = width * 0.5;
      this.y = height * 0.5;
    }

    reset() {
      // Random target position swirling on the left side
      // The left side container is 50% of the screen width. We swirl them roughly in the center of that 50%
      this.targetX = width * 0.5 + (Math.random() - 0.5) * (width * 0.7); 
      this.targetY = height * 0.5 + (Math.random() - 0.5) * (height * 0.8);
      
      // Starting velocities (unused for direct lerp, but useful for idle float)
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = (Math.random() - 0.5) * 1.5;
      
      // Appearance parameters
      this.size = Math.random() * 2.5 + 0.5;
      // Blue, white, and obsidian tones
      const colors = ['rgba(200, 220, 255,', 'rgba(100, 140, 255,', 'rgba(255, 255, 255,', 'rgba(80, 80, 100,'];
      this.baseColor = colors[Math.floor(Math.random() * colors.length)];
      this.alpha = Math.random() * 0.6 + 0.2;
      
      // Wobble phase for the idle float after transition
      this.wobblePhaseX = Math.random() * Math.PI * 2;
      this.wobblePhaseY = Math.random() * Math.PI * 2;
      this.wobbleSpeed = Math.random() * 0.01 + 0.005;
      this.wobbleRadius = Math.random() * 30 + 10;
    }

    update() {
      // Source position: center of the left Work section matching work-cube
      const spawnX = width * 0.5; 
      const spawnY = height * 0.5;

      // Interpolate designated position based on scroll progress (ease out cubic)
      const easeProgress = 1 - Math.pow(1 - effectParams.progress, 3);
      
      const destX = spawnX + (this.targetX - spawnX) * easeProgress;
      const destY = spawnY + (this.targetY - spawnY) * easeProgress;

      // Add fluid motion when fully transitioned
      if (effectParams.progress > 0) {
        this.wobblePhaseX += this.wobbleSpeed;
        this.wobblePhaseY += this.wobbleSpeed;
        
        // The closer to 1 progress is, the more they idle float
        const floatInfluence = effectParams.progress;
        
        this.x = destX + Math.sin(this.wobblePhaseX) * this.wobbleRadius * floatInfluence;
        this.y = destY + Math.cos(this.wobblePhaseY) * this.wobbleRadius * floatInfluence;
        
        // Gentle drift downwards endlessly
        if (effectParams.progress > 0.8) {
             this.targetY -= 0.2;
             if (this.targetY < -50) {
                 this.targetY = height + 50;
                 // Re-randomize x to keep it organic
                 this.targetX = width * 0.5 + (Math.random() - 0.5) * (width * 0.7);
             }
        }
      } else {
         this.x = destX;
         this.y = destY;
      }
    }

    draw(ctx) {
      // Fade in based on progress
      // We want them fully visible quickly, then hold alpha
      let currentAlpha = this.alpha * Math.min(1, effectParams.progress * 3);
      if (currentAlpha <= 0) return;

      ctx.beginPath();
      // Make them slightly cubic to match the theme
      ctx.rect(this.x, this.y, this.size, this.size);
      ctx.fillStyle = `${this.baseColor} ${currentAlpha})`;
      
      // Add glow to some particles
      if (this.size > 1.5 && Math.random() > 0.8) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(200, 220, 255, 0.6)';
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    
    // Only render if we have some progress
    if (effectParams.progress > 0.005) {
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });
    }
    
    requestAnimationFrame(render);
  }

  render();
})();

// ============================================================
//  NEW ENHANCEMENTS: LENIS, SPLITTEXT, CURSOR, HORIZONTAL SCROLL
// ============================================================

// 1. Initialize Lenis Smooth Scroll
let lenis;
if (typeof Lenis !== 'undefined') {
  lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
  });

  // Sync GSAP ScrollTrigger with Lenis (single rAF via GSAP ticker)
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time)=>{
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0, 0);
  } else {
    // Fallback if GSAP isn't loaded
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
}

// 2. Custom Cursor Logic
const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');

if (cursorDot && cursorRing) {
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;
  let dotX = mouseX;
  let dotY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    dotX += (mouseX - dotX) * 0.5;
    dotY += (mouseY - dotY) * 0.5;
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    cursorDot.style.transform = `translate(-50%, -50%) translate3d(${dotX}px, ${dotY}px, 0)`;
    cursorRing.style.transform = `translate(-50%, -50%) translate3d(${ringX}px, ${ringY}px, 0)`;

    requestAnimationFrame(animateCursor);
  }
  requestAnimationFrame(animateCursor);

  // 3. Magnetic UI Elements
  const magnetics = document.querySelectorAll('.magnetic-element');
  magnetics.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      cursorRing.classList.add('active');
      
      const rect = el.getBoundingClientRect();
      const w = rect.width / 2;
      const h = rect.height / 2;
      const x = e.clientX - rect.left - w;
      const y = e.clientY - rect.top - h;

      if (typeof gsap !== 'undefined') {
        gsap.to(el, {
          x: x * 0.4,
          y: y * 0.4,
          duration: 0.4,
          ease: "power2.out"
        });
      }
    });

    el.addEventListener('mouseleave', () => {
      cursorRing.classList.remove('active');
      if (typeof gsap !== 'undefined') {
        gsap.to(el, {
          x: 0,
          y: 0,
          duration: 0.7,
          ease: "elastic.out(1, 0.3)"
        });
      }
    });
  });
}

// 4. Content Reveals & 5. Horizontal Scroll
window.addEventListener('load', () => {
  if (typeof gsap !== 'undefined') {
    
    // Animate headers (standard fade up instead of SplitType to preserve nested spans and gradients)
    const textRevealElements = document.querySelectorAll('.about-title, .portfolio-header h2, .services-header h2, .contact-header h2');
    textRevealElements.forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        },
        y: 35,
        opacity: 0,
        duration: 1.4,
        ease: 'expo.out'
      });
    });

    // Horizontal Scroll for Cases
    const portfolioSection = document.querySelector('.portfolio-section');
    const portfolioGallery = document.querySelector('.portfolio-gallery');

    if (portfolioSection && portfolioGallery && window.innerWidth > 768) {
      // Calculate scroll based on the gallery width vs the container boundary, plus extra buffer
      let casesWidth = portfolioGallery.scrollWidth - portfolioSection.clientWidth;
      
      if (casesWidth > 0) {
        gsap.to(portfolioGallery, {
          x: -casesWidth,
          ease: "none",
          scrollTrigger: {
            trigger: portfolioSection,
            pin: true,
            scrub: 1,
            start: "top 5%", 
            end: () => "+=" + casesWidth * 1.5,
            invalidateOnRefresh: true
          }
        });
      }
    }

    // GSAP scroll reveals for Services section
    gsap.from('.service-item', {
      scrollTrigger: {
        trigger: '.services-list',
        start: 'top 85%',
      },
      y: 40,
      opacity: 0,
      duration: 1.5,
      stagger: 0.2,
      ease: 'expo.out'
    });

    // GSAP scroll reveals for Contact section
    gsap.from('.contact-container', {
      scrollTrigger: {
        trigger: '.contact-section',
        start: 'top 80%',
      },
      y: 50,
      opacity: 0,
      duration: 1.8,
      ease: 'expo.out'
    });

    // GSAP scroll reveals for Footer
    gsap.from('.footer-container', {
      scrollTrigger: {
        trigger: '.site-footer',
        start: 'top 90%',
      },
      y: 30,
      opacity: 0,
      duration: 1.5,
      ease: 'expo.out'
    });
  }
});

// 6. Background Parallax Depth
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 15;
  const y = (e.clientY / window.innerHeight - 0.5) * 15;
  document.body.style.backgroundPosition = `${x}px ${y}px`;
});

// 7. Synthetic Web Audio API Hover Hum
const initAudio = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const audioCtx = new AudioContext();

  const playHoverHum = () => {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime); // Deep bass

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);

    // Envelope generator (soft attack, slow release)
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.3); // Very quiet
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
  };

  const magnetics = document.querySelectorAll('.magnetic-element');
  magnetics.forEach(el => {
    el.addEventListener('mouseenter', playHoverHum);
  });
};

// Wait for first user interaction to unlock AudioContext
window.addEventListener('click', function unlockAudio() {
  initAudio();
  window.removeEventListener('click', unlockAudio);
}, { once: true });

// 8. Form Submit Feedback
const contactForm = document.getElementById('contact-form');
const formToast = document.getElementById('form-toast');

if (contactForm && formToast) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Animate the button
    const btn = contactForm.querySelector('.submit-btn');
    if (btn && typeof gsap !== 'undefined') {
      gsap.to(btn, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
      });
    }

    // Show toast
    formToast.classList.add('visible');
    setTimeout(() => {
      formToast.classList.remove('visible');
    }, 3000);

    // Reset form
    contactForm.reset();
  });
}
