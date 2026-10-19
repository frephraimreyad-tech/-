import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { CONFETTI_COLORS } from "../utils/constants";

export interface ConfettiCanvasRef {
  burst: (x?: number, y?: number) => void;
  celebrateWinner: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: "circle" | "rect" | "star";
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const ConfettiCanvas = forwardRef<ConfettiCanvasRef, { className?: string }>(
  function ConfettiCanvas({ className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animFrameRef = useRef<number | null>(null);

    const spawnParticles = (originX: number, originY: number, count = 70) => {
      const list = particlesRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + 12 * Math.random();
        const shapes: ("circle" | "rect" | "star")[] = ["circle", "rect", "star"];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const maxLife = 70 + 50 * Math.random();

        list.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (Math.random() * 4 + 2),
          size: 6 + 10 * Math.random(),
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          shape,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          alpha: 1,
          life: 0,
          maxLife,
        });
      }
    };

    useImperativeHandle(ref, () => ({
      burst: (x?: number, y?: number) => {
        const canvas = canvasRef.current;
        if (canvas) {
          spawnParticles(x ?? canvas.width / 2, y ?? canvas.height / 3, 80);
        }
      },
      celebrateWinner: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          spawnParticles(0.2 * canvas.width, 0.4 * canvas.height, 90);
          spawnParticles(0.8 * canvas.width, 0.4 * canvas.height, 90);
          setTimeout(() => {
            if (canvasRef.current) {
              spawnParticles(0.5 * canvasRef.current.width, 0.25 * canvasRef.current.height, 130);
            }
          }, 250);
          setTimeout(() => {
            if (canvasRef.current) {
              spawnParticles(0.35 * canvasRef.current.width, 0.3 * canvasRef.current.height, 80);
              spawnParticles(0.65 * canvasRef.current.width, 0.3 * canvasRef.current.height, 80);
            }
          }, 500);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const particles = particlesRef.current;

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.vx *= 0.985; // air drag
          p.rotation += p.rotationSpeed;
          p.life++;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);

          if (p.life >= p.maxLife || p.y > canvas.height + 50) {
            particles.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;

          if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, 2 * Math.PI);
            ctx.fill();
          } else if (p.shape === "rect") {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else {
            // 5-point star
            ctx.beginPath();
            const rOuter = p.size / 2;
            const rInner = p.size / 4;
            let rot = (Math.PI / 2) * 3;
            const step = Math.PI / 5;
            ctx.moveTo(0, -rOuter);
            for (let s = 0; s < 5; s++) {
              let sx = Math.cos(rot) * rOuter;
              let sy = Math.sin(rot) * rOuter;
              ctx.lineTo(sx, sy);
              rot += step;
              sx = Math.cos(rot) * rInner;
              sy = Math.sin(rot) * rInner;
              ctx.lineTo(sx, sy);
              rot += step;
            }
            ctx.lineTo(0, -rOuter);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      animFrameRef.current = requestAnimationFrame(render);

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className={`pointer-events-none fixed inset-0 z-50 h-full w-full ${className}`}
      />
    );
  }
);
