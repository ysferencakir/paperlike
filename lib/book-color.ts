// Deep, cloth-binding-like tones for the shelf view's spine faces — richer
// than the pastel grid-placeholder gradients, closer to how a real book
// spine looks under shelf lighting.
const SPINE_COLORS = ["#7c2d3a", "#1e3a5f", "#2f4a3c", "#8a6a2f", "#4a3a5c", "#3a3530"] as const;

export function spineColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return SPINE_COLORS[hash % SPINE_COLORS.length];
}
