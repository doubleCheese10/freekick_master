
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GamePhase, Point, GameResult, NetSegment } from '../types';
import { 
  FIELD_WIDTH, 
  FIELD_HEIGHT, 
  GOAL_WIDTH, 
  PENALTY_BOX_HEIGHT, 
  PENALTY_BOX_WIDTH,
  BALL_RADIUS,
  GOALIE_RADIUS,
  MAX_POWER_SPEED,
  FRICTION_AIR,
  FRICTION_GROUND,
  FRICTION_POST_IMPACT,
  GOAL_DEPTH,
  MAGNUS_STRENGTH,
  GOAL_AREA_WIDTH,
  GOAL_AREA_HEIGHT,
  FULL_PITCH_WIDTH,
  MIDFIELD_Y,
  CORNER_RADIUS,
  GRAVITY,
  BOUNCE_FACTOR_GROUND,
  BOUNCE_FACTOR_POST,
  STOP_THRESHOLD,
  TIME_SCALE
} from '../constants';

interface GameFieldProps {
  gameState: GamePhase;
  setGameState: (phase: GamePhase) => void;
  onResult: (result: GameResult) => void;
  power: number;
  setPower: (power: number | ((prev: number) => number)) => void;
  ballPos: Point;
  setBallPos: (pos: Point) => void;
  attempts: number;
  isMuted: boolean;
}

// Particle System Types
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// Display constants
// Increased from 200 to 280 to move the field downwards and prevent header overlap on mobile.
const TOP_PADDING = 280; 
const MIN_Y = -TOP_PADDING;
const POST_RADIUS = 5;

// Physics Helper: Vector Math
const vecSub = (v1: Point, v2: Point) => ({ x: v1.x - v2.x, y: v1.y - v2.y });
const vecAdd = (v1: Point, v2: Point) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
const vecMul = (v: Point, s: number) => ({ x: v.x * s, y: v.y * s });
const vecDot = (v1: Point, v2: Point) => v1.x * v2.x + v1.y * v2.y;
const vecLen = (v: Point) => Math.sqrt(v.x * v.x + v.y * v.y);
const vecNorm = (v: Point) => {
  const l = vecLen(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};

export const GameField: React.FC<GameFieldProps> = ({ 
  gameState, 
  setGameState, 
  onResult, 
  power, 
  setPower, 
  ballPos, 
  setBallPos,
  attempts,
  isMuted
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas for Particles
  const requestRef = useRef<number>(0);
  
  // Game Logic State
  const [aimAngle, setAimAngle] = useState(0); 
  const [curve, setCurve] = useState(0); 
  const [goaliePos, setGoaliePos] = useState(FIELD_WIDTH / 2);
  const [predictedPath, setPredictedPath] = useState<Point[]>([]);
  
  // Slingshot State
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);

  // ViewBox State
  const [viewBox, setViewBox] = useState({ x: 0, y: MIN_Y, w: FIELD_WIDTH, h: FIELD_HEIGHT + TOP_PADDING });
  
  // Forces re-render of SVG for net animation even if ball stops
  const [, setTick] = useState(0); 
  
  // Physics state Refs
  const ballVelocity = useRef({ x: 0, y: 0 });
  const ballPositionRef = useRef(ballPos);
  
  // Z-Axis Physics (Height)
  const ballZ = useRef(0);
  const ballVz = useRef(0);
  // Visual state for Z (to render ball scale/shadow)
  const [visualZ, setVisualZ] = useState(0);

  const goalScoredRef = useRef(false);
  const framesAfterGoalRef = useRef(0); 
  const ballStuckRef = useRef(false);
  const kickSequenceStartedRef = useRef(false);
  
  // NET SEGMENTS REF
  const netSegments = useRef<NetSegment[]>([]);

  // Ad Board Ref
  const adOffsetRef = useRef(0);
  
  // Particles Ref
  const particlesRef = useRef<Particle[]>([]);
  
  // Audio Ref
  const whistleAudioRef = useRef<HTMLAudioElement | null>(null);
  const kickAudioRef = useRef<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const pingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Track power in a ref
  const powerRef = useRef(power);
  useEffect(() => { powerRef.current = power; }, [power]);

  useEffect(() => { ballPositionRef.current = ballPos; }, [ballPos]);

  // --- Initialize Audio ---
  useEffect(() => {
    whistleAudioRef.current = new Audio('https://res.letitduo.com/resources/whistle.mp3');
    kickAudioRef.current = new Audio('https://res.letitduo.com/resources/kick.mp3');
    celebrationAudioRef.current = new Audio('https://res.letitduo.com/resources/celebration.mp3');
    pingAudioRef.current = new Audio('https://res.letitduo.com/resources/ping.mp3');
    
    // Preload audio
    whistleAudioRef.current && whistleAudioRef.current.load();
    kickAudioRef.current && kickAudioRef.current.load();
    celebrationAudioRef.current && celebrationAudioRef.current.load();
    pingAudioRef.current && pingAudioRef.current.load();
  }, []);

  const playWhistle = useCallback(() => {
    if (whistleAudioRef.current && !isMuted) {
        whistleAudioRef.current.currentTime = 0;
        whistleAudioRef.current.play().catch(e => {
            console.log("Audio playback waiting for interaction", e);
        });
    }
  }, [isMuted]);

  const playKick = useCallback(() => {
    if (kickAudioRef.current && !isMuted) {
        kickAudioRef.current.currentTime = 0;
        kickAudioRef.current.play().catch(e => {
            console.log("Kick audio playback failed", e);
        });
    }
  }, [isMuted]);

  const playCelebration = useCallback(() => {
    if (celebrationAudioRef.current && !isMuted) {
        celebrationAudioRef.current.currentTime = 0;
        celebrationAudioRef.current.play().catch(e => {
            console.log("Celebration audio playback failed", e);
        });
    }
  }, [isMuted]);

  const playPing = useCallback(() => {
    if (pingAudioRef.current && !isMuted) {
        pingAudioRef.current.currentTime = 0;
        pingAudioRef.current.play().catch(e => {
            console.log("Ping audio playback failed", e);
        });
    }
  }, [isMuted]);

  // --- Responsive ViewBox Calculation ---
  useEffect(() => {
    const updateViewBox = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      // Update Canvas Size to match container
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }

      const containerAspect = width / height;

      // We want to maintain a "Core" playable area around the goal
      const CORE_WIDTH = 600;
      // Core height includes play area + top padding (ad board + header space)
      // Include TOP_PADDING in the logical core height to fit everything vertically
      const CORE_HEIGHT = FIELD_HEIGHT + TOP_PADDING; 
      const coreAspect = CORE_WIDTH / CORE_HEIGHT;

      let vw, vh;

      // If screen is wider than our core aspect, expand width
      if (containerAspect > coreAspect) {
        vh = CORE_HEIGHT;
        vw = vh * containerAspect;
      } else {
        // If screen is taller (mobile), expand height
        vw = CORE_WIDTH;
        vh = vw / containerAspect;
      }

      // Center X around the goal center (FIELD_WIDTH / 2)
      // Anchor Y to the top (MIN_Y)
      const centerX = FIELD_WIDTH / 2;
      const vx = centerX - (vw / 2);
      
      setViewBox({ x: vx, y: MIN_Y, w: vw, h: vh });
    };

    updateViewBox();
    const resizeObserver = new ResizeObserver(updateViewBox);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- Initialize Net Segments ---
  const initNet = useCallback(() => {
    const segments: NetSegment[] = [];
    const goalLeft = (FIELD_WIDTH - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_WIDTH + GOAL_WIDTH) / 2;
    const backY = -GOAL_DEPTH;

    // Helper to add segment
    const addSeg = (p1: Point, p2: Point, nx: number, ny: number) => {
      segments.push({
        A: p1,
        B: p2,
        normal: { x: nx, y: ny }, 
        offset: 0,
        velocity: 0
      });
    };

    // 1. Left Side Net (3 segments)
    const sideSegCount = 3;
    for (let i = 0; i < sideSegCount; i++) {
        const y1 = (i / sideSegCount) * backY;
        const y2 = ((i + 1) / sideSegCount) * backY;
        addSeg({ x: goalLeft, y: y1 }, { x: goalLeft, y: y2 }, 1, 0); 
    }

    // 2. Back Net (12 segments)
    const backSegCount = 12;
    for (let i = 0; i < backSegCount; i++) {
        const x1 = goalLeft + (i / backSegCount) * GOAL_WIDTH;
        const x2 = goalLeft + ((i + 1) / backSegCount) * GOAL_WIDTH;
        addSeg({ x: x1, y: backY }, { x: x2, y: backY }, 0, 1); 
    }

    // 3. Right Side Net (3 segments)
    for (let i = 0; i < sideSegCount; i++) {
        const y1 = backY - (i / sideSegCount) * backY;
        const y2 = backY - ((i + 1) / sideSegCount) * backY;
        addSeg({ x: goalRight, y: y1 }, { x: goalRight, y: y2 }, -1, 0); 
    }

    netSegments.current = segments;
  }, []);

  // Reset logic
  useEffect(() => {
    if (gameState === GamePhase.PLACEMENT) {
      setAimAngle(0);
      setCurve(0);
      setPower(0);
      setDragStart(null);
      setDragCurrent(null);
      initNet();
      ballStuckRef.current = false;
      ballZ.current = 0;
      ballVz.current = 0;
      setVisualZ(0);
      particlesRef.current = []; // Clear particles
      kickSequenceStartedRef.current = false;
      // Play whistle at the start of the round (Placement Phase)
      playWhistle();
    }
    if (gameState === GamePhase.AIMING_DIRECTION) {
       goalScoredRef.current = false;
       framesAfterGoalRef.current = 0;
       ballStuckRef.current = false;
       ballZ.current = 0;
       ballVz.current = 0;
       setVisualZ(0);
       initNet();
       particlesRef.current = []; // Clear particles
       kickSequenceStartedRef.current = false;
       // Default angle pointing somewhat towards goal
       setAimAngle(0);
    }
  }, [gameState, initNet, playWhistle, setPower]);

  // --- Physics: Kick Start ---
  const startKick = useCallback(() => {
    const angleRad = (aimAngle - 90) * (Math.PI / 180);
    const speed = (powerRef.current / 100) * MAX_POWER_SPEED;
    
    ballVelocity.current = {
      x: Math.cos(angleRad) * speed,
      y: Math.sin(angleRad) * speed
    };
    
    // Initial vertical velocity based on power (pop up)
    ballVz.current = (powerRef.current / 100) * 8; 
    ballZ.current = 0;
    
    goalScoredRef.current = false;
    framesAfterGoalRef.current = 0;
    ballStuckRef.current = false;
  }, [aimAngle]);

  const triggerShoot = useCallback(() => {
    if (kickSequenceStartedRef.current) return;
    
    // 1. Lock power meter and input
    kickSequenceStartedRef.current = true;
    
    // 2. Play Kick Sound
    playKick();

    // 3. Execute Shot
    startKick();
    setGameState(GamePhase.SHOOTING);
  }, [startKick, setGameState, playKick]);

  // --- Physics Step with Delta Time ---
  const stepPhysics = (pos: Point, vel: Point, spin: number, isOnGround: boolean, dt: number): { pos: Point, vel: Point } => {
    const speed = vecLen(vel);
    
    // Magnus Force (Curve)
    // Effect reduced significantly when on ground
    let fx = 0, fy = 0;
    if (speed > 0.1) {
      const nx = vel.x / speed;
      const ny = vel.y / speed;
      // If on ground, spin friction eats the curve force
      const effectiveSpin = isOnGround ? spin * 0.2 : spin;
      const forceMag = effectiveSpin * MAGNUS_STRENGTH * speed; 
      
      // Force applied over time dt
      fx = -ny * forceMag * dt; 
      fy = nx * forceMag * dt;
    }

    let vx = vel.x + fx;
    let vy = vel.y + fy;
    
    // Apply friction based on state (Air vs Ground)
    // Friction is exponential decay: vel = vel * friction^dt
    const frictionBase = isOnGround ? FRICTION_GROUND : FRICTION_AIR;
    const friction = Math.pow(frictionBase, dt);
    
    vx *= friction;
    vy *= friction;
    
    if (isOnGround && speed < STOP_THRESHOLD) {
      vx = 0;
      vy = 0;
    }

    return {
      pos: { x: pos.x + vx * dt, y: pos.y + vy * dt },
      vel: { x: vx, y: vy }
    };
  };

  // --- NET PHYSICS & COLLISION ---
  const updateNetPhysics = (currentPos: Point, predictedPos: Point, vel: Point, dt: number) => {
    let bestHit: { segIndex: number, dist: number, normal: Point, point: Point } | null = null;
    let newPos = predictedPos;
    let newVel = vel;

    // 1. Sweep Collision Detection
    const midPoint = vecMul(vecAdd(currentPos, predictedPos), 0.5);

    netSegments.current.forEach((seg, index) => {
        const disp = vecMul(seg.normal, -Math.abs(seg.offset)); 
        const A = vecAdd(seg.A, disp);
        const B = vecAdd(seg.B, disp);

        const AB = vecSub(B, A);
        const AM = vecSub(midPoint, A);
        const t = Math.max(0, Math.min(1, vecDot(AM, AB) / vecDot(AB, AB)));
        const closest = vecAdd(A, vecMul(AB, t));
        
        const distVec = vecSub(midPoint, closest);
        const dist = vecLen(distVec);

        if (dist < BALL_RADIUS) {
            if (!bestHit || dist < bestHit.dist) {
                bestHit = {
                    segIndex: index,
                    dist: dist,
                    normal: seg.normal,
                    point: closest
                };
            }
        }
    });

    if (bestHit) {
        const seg = netSegments.current[bestHit.segIndex];
        const normal = seg.normal; 

        const impactSpeed = vecLen(newVel);
        const dotNormal = vecDot(vecNorm(newVel), normal);
        
        // Easier to stick: Increased speed threshold from 2.0 to 8.0
        if (impactSpeed < 8.0 && dotNormal > -0.9) {
            ballStuckRef.current = true;
            newVel = { x: 0, y: 0 };
        } else {
            const penetration = BALL_RADIUS - bestHit.dist;
            // correction
            newPos = vecAdd(bestHit.point, vecMul(normal, BALL_RADIUS + 0.1));

            const vDotN = vecDot(newVel, normal);
            let refX = newVel.x - 2 * vDotN * normal.x;
            let refY = newVel.y - 2 * vDotN * normal.y;
            
            // SIGNIFICANTLY REDUCED RESTITUTION FOR "DEAD" FEEL
            const restitution = 0.05;
            newVel.x = refX * restitution;
            newVel.y = refY * restitution;

            // Kill vertical velocity (height) on net hit to make it drop
            ballVz.current *= 0.1;

            const tx = -normal.y;
            const ty = normal.x;
            const vTan = newVel.x * tx + newVel.y * ty;
            
            // INCREASED TANGENTIAL FRICTION
            newVel.x = normal.x * (newVel.x * normal.x + newVel.y * normal.y) + tx * vTan * 0.05;
            newVel.y = normal.y * (newVel.x * normal.x + newVel.y * normal.y) + ty * vTan * 0.05;

            // Impact is instantaneous force, doesn't need dt scaling
            const impactForce = Math.abs(vDotN) * 2;
            seg.velocity += impactForce; 
        }
    }

    netSegments.current.forEach(seg => {
        const k = 0.1;
        const force = -k * seg.offset;
        // Apply force over time dt
        seg.velocity += force * dt;
        // Decay over time dt
        seg.velocity *= Math.pow(0.92, dt); 
        seg.offset += seg.offset + seg.velocity * dt;
        if (seg.offset < -2) seg.offset = -2; 
    });

    return { newPos, newVel };
  };

  // --- Trajectory Prediction ---
  const updatePredictedPath = useCallback(() => {
    // Only predict when aiming or pulling back
    if (gameState !== GamePhase.AIMING_DIRECTION && gameState !== GamePhase.PULL_BACK) return;
    
    const angleRad = (aimAngle - 90) * (Math.PI / 180);
    // Use current power or default to 50 for visualization if not pulling
    const simPower = gameState === GamePhase.PULL_BACK ? power : 50;
    const simSpeed = (simPower / 100) * MAX_POWER_SPEED * 0.85; 
    
    let simVel = { x: Math.cos(angleRad) * simSpeed, y: Math.sin(angleRad) * simSpeed };
    let simPos = { ...ballPos };
    
    // In direction phase, no curve. In pull back, use calculated curve.
    const simCurve = gameState === GamePhase.PULL_BACK ? curve : 0;
    const simSpin = simCurve * 0.05; 
    
    const points: Point[] = [simPos];

    for (let i = 0; i < 100; i++) {
      const result = stepPhysics(simPos, simVel, simSpin, false, 1.0); 
      simPos = result.pos;
      simVel = result.vel;
      if (i % 3 === 0) points.push(simPos);
      if (simPos.y < -GOAL_DEPTH || simPos.y > FIELD_HEIGHT + 300 || simPos.x < -200 || simPos.x > FIELD_WIDTH + 200) break;
    }
    setPredictedPath(points);
  }, [ballPos, aimAngle, curve, gameState, power]);

  useEffect(() => { updatePredictedPath(); }, [updatePredictedPath]);

  // --- Post Collision Logic ---
  const handlePostCollisions = (pos: Point, vel: Point): { pos: Point, vel: Point } => {
     let newPos = { ...pos };
     let newVel = { ...vel };
     const goalLeftX = (FIELD_WIDTH - GOAL_WIDTH) / 2;
     const goalRightX = (FIELD_WIDTH + GOAL_WIDTH) / 2;
     const posts = [{ x: goalLeftX, y: 0 }, { x: goalRightX, y: 0 }];

     for (const post of posts) {
        const dx = newPos.x - post.x;
        const dy = newPos.y - post.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = BALL_RADIUS + POST_RADIUS;

        if (dist < minDist) {
           const nx = dx / dist;
           const ny = dy / dist;
           const dot = newVel.x * nx + newVel.y * ny;
           
           // REFLECTION
           newVel.x = (newVel.x - 2 * dot * nx);
           newVel.y = (newVel.y - 2 * dot * ny);
           
           // HEAVY DAMPING on impact
           newVel.x *= BOUNCE_FACTOR_POST;
           newVel.y *= BOUNCE_FACTOR_POST;
           
           // ADDITIONAL STOPPING POWER:
           newVel.x *= FRICTION_POST_IMPACT;
           newVel.y *= FRICTION_POST_IMPACT;

           // Pop the ball up slightly if it hits hard
           ballVz.current = Math.abs(dot) * 0.2; 

           // Play Ping Sound
           playPing();

           // Correct position
           newPos.x = post.x + nx * minDist;
           newPos.y = post.y + ny * minDist;
        }
     }
     return { pos: newPos, vel: newVel };
  };

  // --- Check Goal Logic ---
  const checkGoal = (x: number, y: number, currentSpeed: number): GameResult => {
    const goalLeft = (FIELD_WIDTH - GOAL_WIDTH) / 2;
    const goalRight = (FIELD_WIDTH + GOAL_WIDTH) / 2;
    
    if (y <= 0 && y > -GOAL_DEPTH) {
      if (x > goalLeft + BALL_RADIUS && x < goalRight - BALL_RADIUS) {
        const distToGoalie = Math.sqrt(Math.pow(x - goaliePos, 2) + Math.pow(y - 0, 2)); 
        const reach = GOALIE_RADIUS * 3.5; 
        if (distToGoalie < reach && !goalScoredRef.current) {
            const curveFactor = Math.abs(curve);
            const speedFactor = currentSpeed / MAX_POWER_SPEED; 
            const saveProbability = 0.8 - (curveFactor * 0.04) - (speedFactor * 0.3);
            if (Math.random() < saveProbability) return 'SAVED';
        }
        return 'GOAL';
      }
    }
    // Expanded Miss Check area
    if (y < -GOAL_DEPTH - 50 || x < -500 || x > FIELD_WIDTH + 500 || y > FIELD_HEIGHT + 500) {
       if (y < 0 && !goalScoredRef.current) return 'MISS';
    }
    return null;
  };

  // --- Particle System Logic ---
  const emitParticles = (pos: Point, vel: Point) => {
    const speed = vecLen(vel);
    // Only emit if moving fast enough
    if (speed < 1.0) return;

    // Emit 2 particles per frame
    for (let i = 0; i < 2; i++) {
        const angle = Math.atan2(vel.y, vel.x);
        // Reverse direction + spread
        const particleAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5; 
        const particleSpeed = Math.random() * speed * 0.3; // 30% of ball speed
        
        particlesRef.current.push({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(particleAngle) * particleSpeed,
            vy: Math.sin(particleAngle) * particleSpeed,
            life: 20 + Math.random() * 10,
            maxLife: 30,
            size: 4 + Math.random() * 4,
            color: `rgba(255, ${Math.floor(100 + Math.random() * 155)}, 0, 1)` // Yellow-Orange
        });
    }
  };

  const updateParticles = (dt: number) => {
      particlesRef.current.forEach(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          p.size *= Math.pow(0.96, dt);
      });
      // Remove dead particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Calculate coordinate scale from Game World to Canvas Pixel
      const scaleX = ctx.canvas.width / viewBox.w;
      const scaleY = ctx.canvas.height / viewBox.h;

      ctx.globalCompositeOperation = "lighter"; // Glow effect

      particlesRef.current.forEach(p => {
          // Convert Game Coords to Screen Coords
          const screenX = (p.x - viewBox.x) * scaleX;
          const screenY = (p.y - viewBox.y) * scaleY;
          const screenSize = p.size * scaleX; // Scale size roughly by X scale

          const alpha = p.life / p.maxLife;
          
          const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenSize);
          gradient.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
          gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(screenX, screenY, screenSize, 0, Math.PI * 2);
          ctx.fill();
      });

      ctx.globalCompositeOperation = "source-over"; // Reset
  };

  // --- Animation Loop ---
  const animate = useCallback((time: number) => {
    
    // Determine Time Scale (Slow Motion only during shooting)
    const dt = (gameState === GamePhase.SHOOTING) ? TIME_SCALE : 1.0;
    
    // Update Ad Board offset
    adOffsetRef.current += 1.5 * dt;

    if (gameState === GamePhase.SHOOTING) {
      
      // Goalie AI
      if (!goalScoredRef.current) {
        setGoaliePos(prev => {
           const targetX = ballPositionRef.current.x;
           const diff = targetX - prev;
           const maxMove = 2.5 * dt; // Scale goalie speed too
           if (targetX > 0 && targetX < FIELD_WIDTH) return prev + Math.max(-maxMove, Math.min(maxMove, diff));
           return prev;
        });
      }

      if (ballStuckRef.current) {
          setTick(t => t + 1);
          updateNetPhysics(ballPositionRef.current, ballPositionRef.current, {x:0, y:0}, dt);
          if (!goalScoredRef.current) {
             goalScoredRef.current = true;
             playCelebration();
          }
      } else {
        // --- 2.5D Height Physics ---
        if (ballZ.current > 0 || ballVz.current > 0) {
           ballZ.current += ballVz.current * dt;
           ballVz.current -= GRAVITY * dt;
           if (ballZ.current <= 0) {
              ballZ.current = 0;
              // Bounce on ground logic
              ballVz.current = -ballVz.current * BOUNCE_FACTOR_GROUND;
              // If bounce is tiny, stop bouncing
              if (Math.abs(ballVz.current) < 1.0) ballVz.current = 0;
           }
        }
        setVisualZ(ballZ.current);
        const isOnGround = ballZ.current <= 0;

        // Decrease curve (spin) if on ground
        if (isOnGround) {
            setCurve(prev => prev * Math.pow(0.9, dt)); 
        }

        const spin = curve * 0.05; 
        
        // --- Step XY Physics ---
        let result = stepPhysics(ballPositionRef.current, ballVelocity.current, spin, isOnGround, dt);
        
        const postRes = handlePostCollisions(result.pos, result.vel);
        result.pos = postRes.pos;
        result.vel = postRes.vel;

        const netRes = updateNetPhysics(ballPositionRef.current, result.pos, result.vel, dt);
        result.pos = netRes.newPos;
        result.vel = netRes.newVel;
        
        ballVelocity.current = result.vel;
        ballPositionRef.current = result.pos;
        setBallPos(result.pos);
        setTick(t => t + 1);

        // --- PARTICLES ---
        if (!ballStuckRef.current && vecLen(ballVelocity.current) > 2.0) {
            emitParticles(ballPositionRef.current, ballVelocity.current);
        }

        const speed = vecLen(result.vel);

        if (!goalScoredRef.current) {
            const gameResult = checkGoal(result.pos.x, result.pos.y, speed);
            if (gameResult === 'GOAL') {
                goalScoredRef.current = true;
                playCelebration();
            } else if (gameResult) {
                onResult(gameResult);
            } else if (isOnGround && speed === 0) {
                onResult('MISS');
            }
        }
      }

      // Update and Draw Particles
      updateParticles(dt);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) drawParticles(ctx);
      }

      if (goalScoredRef.current) {
         framesAfterGoalRef.current += 1 * dt; // Count frames by time
         const speed = vecLen(ballVelocity.current);
         // Stop game quicker if ball stops
         if ((speed < STOP_THRESHOLD || ballStuckRef.current) && framesAfterGoalRef.current > 60) {
             onResult('GOAL');
         } else if (framesAfterGoalRef.current > 200) {
             onResult('GOAL');
         }
      }
      requestRef.current = requestAnimationFrame(animate);
    } else {
      setGoaliePos(FIELD_WIDTH / 2);
      setTick(t => t + 1); 
      // Clear canvas when not shooting
      if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [gameState, onResult, setPower, setBallPos, goaliePos, curve, playCelebration, playPing]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // Coordinate conversion helper
  const getSVGCoords = (clientX: number, clientY: number, svgElement: SVGSVGElement) => {
      const svgRect = svgElement.getBoundingClientRect();
      const scaleX = viewBox.w / svgRect.width;
      const scaleY = viewBox.h / svgRect.height;
      return {
          x: viewBox.x + (clientX - svgRect.left) * scaleX,
          y: viewBox.y + (clientY - svgRect.top) * scaleY
      };
  };

  // --- Interaction Handlers ---

  const handleFieldClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only handle click for placement phase. 
    // Aiming and Pullback use MouseDown/Up logic
    if (gameState === GamePhase.PLACEMENT) {
      const { x, y } = getSVGCoords(e.clientX, e.clientY, e.currentTarget);
      const boxLeft = (FIELD_WIDTH - PENALTY_BOX_WIDTH) / 2;
      const boxRight = (FIELD_WIDTH + PENALTY_BOX_WIDTH) / 2;
      const boxBottom = PENALTY_BOX_HEIGHT;
      const isInsideBox = x > boxLeft && x < boxRight && y < boxBottom;
      if (!isInsideBox && y > 0 && y < FIELD_HEIGHT - 10 && x > 0 && x < FIELD_WIDTH) {
        setBallPos({ x, y });
        setGameState(GamePhase.AIMING_DIRECTION);
      }
    }
  };

  const handlePointerDown = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const { x, y } = getSVGCoords(clientX, clientY, svg);
    
    if (gameState === GamePhase.AIMING_DIRECTION) {
      // Just updating aim on move, click confirms via button
    } else if (gameState === GamePhase.PULL_BACK) {
      // Start Dragging
      setDragStart({ x, y });
      setDragCurrent({ x, y });
    }
  };

  const handlePointerMove = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const { x, y } = getSVGCoords(clientX, clientY, svg);

    if (gameState === GamePhase.AIMING_DIRECTION) {
      // Calculate angle from ball to cursor
      const dx = x - ballPos.x;
      const dy = y - ballPos.y;
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      let gameAngle = angleDeg + 90; 
      if (gameAngle > 180) gameAngle -= 360;
      setAimAngle(Math.max(-80, Math.min(80, gameAngle)));
    } else if (gameState === GamePhase.PULL_BACK && dragStart) {
      setDragCurrent({ x, y });
      
      // Calculate Drag Vector (Start - Current) -> The pull force vector
      const dragDx = dragStart.x - x;
      const dragDy = dragStart.y - y;
      const dragLen = Math.sqrt(dragDx*dragDx + dragDy*dragDy);
      
      // Power is proportional to drag length
      // Let's say 150 pixels drag = 100% power
      const maxDrag = 150;
      const currentPower = Math.min(100, (dragLen / maxDrag) * 100);
      setPower(currentPower);
      
      // Curve Calculation
      // Project the Drag Vector onto the Aim Vector's Perpendicular Vector (Right)
      // Aim Vector (Forward)
      const aimRad = (aimAngle - 90) * (Math.PI / 180);
      const aimNx = Math.cos(aimRad);
      const aimNy = Math.sin(aimRad);
      
      // Perpendicular Vector (Left? Right?)
      // Let's check rotation: (x, y) -> (-y, x) is 90 deg CCW (Left in standard math)
      // But Y is down.
      // Let's use simple logic:
      // If drag point is to the LEFT of the aim line, ball curves LEFT.
      // Lateral distance: 
      // Line is defined by BallPos and AimAngle.
      // Vector from Ball to DragPoint: V_bd
      // Cross Product in 2D (Determinant) tells us side.
      // Det(A, B) = AxBy - AyBx
      
      const vBallDragX = x - ballPos.x;
      const vBallDragY = y - ballPos.y;
      
      // Cross AimVector with BallDragVector
      // If positive, it's on one side, negative on other.
      const cross = aimNx * vBallDragY - aimNy * vBallDragX;
      
      // Scaling factor for curve
      // Max curve is 10.
      const curveScale = 20; 
      // If cross is positive (Right side), curve is positive (Right)?
      // Let's clamp
      const rawCurve = cross / curveScale;
      setCurve(Math.max(-10, Math.min(10, rawCurve)));
    }
  };

  const handlePointerUp = () => {
    if (gameState === GamePhase.PULL_BACK && dragStart && dragCurrent) {
        // Trigger Shot
        triggerShoot();
        setDragStart(null);
        setDragCurrent(null);
    }
  };

  // React Event Wrappers
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => handlePointerDown(e.clientX, e.clientY, e.currentTarget);
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => handlePointerMove(e.clientX, e.clientY, e.currentTarget);
  const onMouseUp = () => handlePointerUp();
  const onTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget);
  };
  const onTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget);
  };
  const onTouchEnd = () => handlePointerUp();

  // --- Rendering Functions ---
  const renderAimLine = () => {
    if ((gameState !== GamePhase.AIMING_DIRECTION && gameState !== GamePhase.PULL_BACK) || predictedPath.length < 2) return null;
    
    // In direction phase, show straight arrow
    if (gameState === GamePhase.AIMING_DIRECTION) {
        return (
            <g>
                <line 
                  x1={ballPos.x} y1={ballPos.y} 
                  x2={predictedPath[predictedPath.length-1].x} y2={predictedPath[predictedPath.length-1].y}
                  stroke="rgba(255,255,255,0.8)" 
                  strokeWidth="2" 
                  strokeDasharray="5,5" 
                />
                <circle cx={predictedPath[predictedPath.length-1].x} cy={predictedPath[predictedPath.length-1].y} r="3" fill="white" />
            </g>
        )
    }

    // In Pull Back phase, show curved prediction
    return (
      <>
        <polyline 
          points={predictedPath.map(p => `${p.x},${p.y}`).join(' ')} 
          fill="none" 
          stroke={Math.abs(curve) > 2 ? "#fbbf24" : "rgba(255, 255, 255, 0.9)"} 
          strokeWidth="3"
          strokeDasharray="5,5"
          strokeLinecap="round"
          opacity="0.8"
        />
        {predictedPath.length > 0 && <circle cx={predictedPath[predictedPath.length-1].x} cy={predictedPath[predictedPath.length-1].y} r="4" fill="white" opacity="0.6" />}
      </>
    );
  };

  const renderSlingshot = () => {
    if (gameState === GamePhase.PULL_BACK && dragStart && dragCurrent) {
        return (
            <g>
                {/* Tension Line */}
                <line 
                    x1={ballPos.x} y1={ballPos.y} 
                    x2={dragCurrent.x} y2={dragCurrent.y} 
                    stroke="rgba(255,255,255,0.5)" 
                    strokeWidth="2" 
                />
                {/* Drag Handle */}
                <circle cx={dragCurrent.x} cy={dragCurrent.y} r="15" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="2" />
                <circle cx={dragCurrent.x} cy={dragCurrent.y} r="5" fill="white" />
                
                {/* Text Info */}
                <text x={dragCurrent.x} y={dragCurrent.y + 30} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                   {Math.round(power)}%
                </text>
                 <text x={dragCurrent.x} y={dragCurrent.y + 45} textAnchor="middle" fill="#fbbf24" fontSize="10">
                   弧度: {Math.round(curve * 10) / 10}
                </text>
            </g>
        )
    }
    return null;
  }

  const renderConfirmDirectionButton = () => {
    if (gameState === GamePhase.AIMING_DIRECTION) {
        const btnY = ballPos.y + 60;
        return (
            <g 
              onClick={(e) => {
                 e.stopPropagation();
                 setGameState(GamePhase.PULL_BACK);
              }} 
              style={{cursor: 'pointer'}}
            >
                <rect x={ballPos.x - 60} y={btnY} width="120" height="36" rx="18" fill="#2563eb" stroke="white" strokeWidth="2" />
                <text x={ballPos.x} y={btnY + 24} textAnchor="middle" fill="white" fontWeight="bold" fontSize="14">确认方向</text>
            </g>
        )
    }
    return null;
  }

  const renderNet = () => {
      if (netSegments.current.length === 0) return null;
      const elements: React.ReactElement[] = [];
      netSegments.current.forEach((seg, i) => {
          const disp = vecMul(seg.normal, -seg.offset); 
          const A = vecAdd(seg.A, disp);
          const B = vecAdd(seg.B, disp);
          elements.push(
              <line key={`net-${i}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          );
      });
      return <g>{elements}</g>;
  };

  const renderAdBoard = () => {
    // Position fixed relative to goal (-140) to be visible but under the header
    const yPos = -140; 
    const height = 60;
    // Dynamic width to cover the full visible area
    const boardX = viewBox.x - 50;
    const boardW = viewBox.w + 100;
    
    const textStr = " • 任意球大师傅 • 门将噩梦，吗？ • 精准打击 • 不好好踢，国足超过你 ";
    const textWidth = 1200; 
    const scroll = (adOffsetRef.current * 1.5) % textWidth;

    return (
      <g>
         <rect x={boardX} y={yPos} width={boardW} height={height} fill="#111" stroke="#333" strokeWidth="4" />
         <rect x={boardX + 10} y={yPos + 5} width={boardW - 20} height={height - 10} fill="#000" />
         <clipPath id="adBoardClip">
            <rect x={boardX + 10} y={yPos + 5} width={boardW - 20} height={height - 10} />
         </clipPath>
         <g clipPath="url(#adBoardClip)">
            <text 
              x={boardX - scroll} 
              y={yPos + 40} 
              fill="#ef4444" 
              fontFamily="monospace" 
              fontWeight="bold" 
              fontSize="32"
              style={{ letterSpacing: '4px' }}
            >
              {textStr.repeat(10)}
            </text>
         </g>
         <rect x={boardX + 10} y={yPos + 5} width={boardW - 20} height={height - 10} fill="url(#ledPattern)" opacity="0.3" pointerEvents="none" />
         <rect x={boardX + 10} y={yPos + 5} width={boardW - 20} height={(height - 10)/2} fill="white" opacity="0.05" pointerEvents="none" />
      </g>
    );
  };

  const renderExtendedField = () => {
     const cx = FIELD_WIDTH / 2;
     const leftLineX = cx - FULL_PITCH_WIDTH / 2;
     const rightLineX = cx + FULL_PITCH_WIDTH / 2;

     return (
       <g stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none">
          <line x1={leftLineX} y1={0} x2={leftLineX} y2={FULL_PITCH_WIDTH} />
          <line x1={rightLineX} y1={0} x2={rightLineX} y2={FULL_PITCH_WIDTH} />
          <line x1={leftLineX} y1={0} x2={(FIELD_WIDTH - GOAL_WIDTH)/2} y2={0} />
          <line x1={(FIELD_WIDTH + GOAL_WIDTH)/2} y1={0} x2={rightLineX} y2={0} />
          <path d={`M ${leftLineX} ${CORNER_RADIUS} A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${leftLineX + CORNER_RADIUS} 0`} />
          <path d={`M ${rightLineX} ${CORNER_RADIUS} A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${rightLineX - CORNER_RADIUS} 0`} />
          <line x1={leftLineX} y1={MIDFIELD_Y} x2={rightLineX} y2={MIDFIELD_Y} />
          <circle cx={cx} cy={MIDFIELD_Y} r={100} />
          <circle cx={cx} cy={MIDFIELD_Y} r={3} fill="white" />
       </g>
     )
  }

  const goalLeftX = (FIELD_WIDTH - GOAL_WIDTH) / 2;
  const goalRightX = (FIELD_WIDTH + GOAL_WIDTH) / 2;

  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden bg-[#15803d] touch-none">
      
      {/* HUD Info */}
      <div className="absolute bottom-56 left-4 flex flex-col gap-1 pointer-events-none z-10">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">当前阶段</span>
        <div className="text-xl font-black text-white">
          {gameState === GamePhase.AIMING_DIRECTION && '设定方向'}
          {gameState === GamePhase.PULL_BACK && '拉动蓄力'}
          {gameState === GamePhase.SHOOTING && '射门!'}
        </div>
      </div>

      <canvas 
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
      />

      <svg 
        width="100%" 
        height="100%" 
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} 
        preserveAspectRatio="none"
        className="cursor-crosshair w-full h-full shadow-2xl touch-none"
        onClick={handleFieldClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          <pattern id="grassPattern" width="60" height="60" patternUnits="userSpaceOnUse">
             <rect width="60" height="60" fill="#15803d" />
             <rect width="60" height="30" fill="#166534" fillOpacity="0.4" />
          </pattern>
          <pattern id="ledPattern" width="4" height="4" patternUnits="userSpaceOnUse">
             <circle cx="2" cy="2" r="1" fill="black" />
          </pattern>
          <filter id="glow">
             <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
             <feMerge>
                 <feMergeNode in="coloredBlur"/>
                 <feMergeNode in="SourceGraphic"/>
             </feMerge>
          </filter>
        </defs>

        {/* Huge Field Background - Starts from top of viewport to cover header area */}
        <rect x={viewBox.x - 500} y={viewBox.y - 100} width={viewBox.w + 1000} height={Math.max(FIELD_HEIGHT, viewBox.h + 500) + 200} fill="url(#grassPattern)" />

        {/* Ad Board */}
        {renderAdBoard()}
        
        {/* Full Pitch Markings */}
        {renderExtendedField()}

        {/* Penalty Area Lines */}
        <g stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none">
          <rect 
            x={(FIELD_WIDTH - PENALTY_BOX_WIDTH) / 2} 
            y="0" 
            width={PENALTY_BOX_WIDTH} 
            height={PENALTY_BOX_HEIGHT} 
          />
          <rect 
            x={(FIELD_WIDTH - GOAL_AREA_WIDTH) / 2} 
            y="0" 
            width={GOAL_AREA_WIDTH} 
            height={GOAL_AREA_HEIGHT} 
          />
          <path 
            d={`M ${(FIELD_WIDTH/2) - 70} ${PENALTY_BOX_HEIGHT} A 70 70 0 0 0 ${(FIELD_WIDTH/2) + 70} ${PENALTY_BOX_HEIGHT}`} 
          />
          <circle cx={FIELD_WIDTH / 2} cy={PENALTY_BOX_HEIGHT - 80} r="3" fill="white" />
        </g>
        
        {/* Goal Structure */}
        <g transform={`translate(0, 0)`}>
          <rect x={goalLeftX} y={-GOAL_DEPTH} width={GOAL_WIDTH} height={GOAL_DEPTH} fill="rgba(0,0,0,0.3)" />
          {renderNet()}
          <circle cx={goalLeftX} cy="0" r={POST_RADIUS} fill="#ccc" stroke="#888" strokeWidth="2" />
          <circle cx={goalRightX} cy="0" r={POST_RADIUS} fill="#ccc" stroke="#888" strokeWidth="2" />
          <line x1={goalLeftX} y1={-2} x2={goalRightX} y2={-2} stroke="#ddd" strokeWidth="4" />
        </g>

        {/* Dynamic Aim Line */}
        {renderAimLine()}
        {renderSlingshot()}
        {renderConfirmDirectionButton()}

        {/* Goalkeeper */}
        <g transform={`translate(${goaliePos}, 5)`}>
          <circle r={GOALIE_RADIUS} fill="#ef4444" stroke="white" strokeWidth="2" />
          <text y="4" fontSize="10" textAnchor="middle" fill="white" fontWeight="bold">守门员</text>
          <line x1={-12} y1="0" x2={12} y2="0" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Ball Rendering */}
        <g transform={`translate(${ballPos.x}, ${ballPos.y})`}>
          <ellipse 
             cx="0" cy="0" 
             rx={BALL_RADIUS * (1 - Math.min(0.5, visualZ/100))} 
             ry={BALL_RADIUS * 0.5 * (1 - Math.min(0.5, visualZ/100))} 
             fill="rgba(0,0,0,0.5)" 
          />
          <g transform={`translate(0, ${-visualZ})`}>
             <g transform={`scale(${BALL_RADIUS / 15}) rotate(${ballPos.x + ballPos.y})`}>
                <g transform="translate(-15, -15)">
                    <circle cx="15" cy="15" r="14" fill="#ffffff" stroke="#000000" strokeWidth="2"/>
                    <polygon points="15,7 22,12 19,20 11,20 8,12" fill="#000000"/>
                    <g stroke="#000000" strokeWidth="2" strokeLinecap="round">
                        <line x1="15" y1="7" x2="15" y2="1" />
                        <line x1="22" y1="12" x2="28" y2="8" />
                        <line x1="19" y1="20" x2="24" y2="27" />
                        <line x1="11" y1="20" x2="6" y2="27" />
                        <line x1="8" y1="12" x2="2" y2="8" />
                    </g>
                </g>
             </g>
          </g>
        </g>
      </svg>
    </div>
  );
};
