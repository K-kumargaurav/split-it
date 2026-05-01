// Tiny DOM confetti. ~80 colored squares animate from a center burst, then
// the container is removed. Pure DOM + CSS keyframes (defined in globals.css)
// so we don't pull in canvas-confetti for a one-off celebration.
//
// Safe to call from any client component — no-ops on the server. Honors
// prefers-reduced-motion.

const COLORS = [
  "#6366F1", // indigo-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EC4899", // pink-500
  "#3B82F6", // blue-500
];

export function fireConfetti(): void {
  if (typeof window === "undefined") return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) return;

  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "overflow:hidden",
    "z-index:9999",
  ].join(";");

  const COUNT = 80;
  for (let i = 0; i < COUNT; i++) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * i) / COUNT + Math.random() * 0.4;
    const distance = 180 + Math.random() * 220;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance + 100; // bias downward (gravity)
    const size = 6 + Math.random() * 6;
    const color = COLORS[i % COLORS.length];
    const rotate = Math.random() * 720 - 360;
    const delay = Math.random() * 80;
    const duration = 1100 + Math.random() * 600;

    piece.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      `width:${size}px`,
      `height:${size * 0.4}px`,
      `background:${color}`,
      "border-radius:1px",
      "transform:translate(-50%,-50%)",
      "opacity:0",
      `animation:splitEasyConfettiFall ${duration}ms cubic-bezier(.2,.6,.3,1) ${delay}ms forwards`,
      `--dx:${dx}px`,
      `--dy:${dy}px`,
      `--rot:${rotate}deg`,
    ].join(";");

    root.appendChild(piece);
  }

  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 2200);
}
