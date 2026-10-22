import type { RenderObject } from '@little-galaxy/shared';
import type { BufferAttribute, InterleavedBufferAttribute } from 'three';
export type Point = [number, number, number];
export const RING_TILT = 1.05;
/** A snapshot baseline is never an arrival animation. Empty/reconnect snapshots do not reset it. */
export class BodyHistory {
  previous = new Map<string, RenderObject>();
  births = new Map<string, number>();
  initialized = false;
  diff(objects: RenderObject[], now: number): RenderObject[] {
    const ids = new Set(objects.map((o) => o.id));
    const removed: RenderObject[] = [];
    for (const [id, o] of this.previous) if (!ids.has(id)) removed.push(o);
    for (const [id, at] of this.births) if (!ids.has(id) || now - at >= 1200) this.births.delete(id);
    if (this.initialized && this.previous.size) for (const o of objects) if (!this.previous.has(o.id)) this.births.set(o.id, now);
    if (objects.length) this.initialized = true;
    this.previous = new Map(objects.map((o) => [o.id, o]));
    return removed;
  }
  private now = 0;
  private pruneEntry = (at: number, id: string) => { if (this.now - at >= 1200) this.births.delete(id); };
  prune(now: number) { this.now = now; this.births.forEach(this.pruneEntry); }
}
export interface Lamp { id: string; position: Point; colour: Point }
interface Node { lamp: Lamp; axis: number; left?: Node; right?: Node }
function tree(lamps: Lamp[], depth = 0): Node | undefined {
  if (!lamps.length) return;
  const axis = depth % 3;
  lamps.sort((a, b) => a.position[axis] - b.position[axis]);
  const middle = Math.floor(lamps.length / 2);
  return { lamp: lamps[middle], axis, left: tree(lamps.slice(0, middle), depth + 1), right: tree(lamps.slice(middle + 1), depth + 1) };
}
/** Fixed visitor stars: build once per snapshot, nearest-neighbour lookup without frame allocations. */
export class StarIndex {
  root?: Node;
  best?: Lamp;
  distance = Infinity;
  constructor(lamps: Lamp[]) { this.root = tree([...lamps]); }
  nearest(point: Point, exclude: string): Lamp | undefined {
    this.best = undefined; this.distance = Infinity;
    this.search(this.root, point, exclude);
    return this.best;
  }
  private search(node: Node | undefined, p: Point, exclude: string) {
    if (!node) return;
    const q = node.lamp.position;
    const distance = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
    if (node.lamp.id !== exclude && distance < this.distance) { this.best = node.lamp; this.distance = distance; }
    const delta = p[node.axis] - q[node.axis];
    this.search(delta < 0 ? node.left : node.right, p, exclude);
    if (delta * delta <= this.distance) this.search(delta < 0 ? node.right : node.left, p, exclude);
  }
}
export interface UpdateRange { start: number; count: number }
/** Three clears the ranges after upload; recycle the same range object for the next frame. */
export function markLiveRange(attribute: BufferAttribute | InterleavedBufferAttribute, count: number, range: UpdateRange) {
  if ('isInterleavedBufferAttribute' in attribute || !count) return;
  range.count = count * attribute.itemSize;
  attribute.clearUpdateRanges();
  attribute.updateRanges.push(range);
  attribute.needsUpdate = true;
}
