import { createRoot } from 'react-dom/client';
import type { MemoryObject } from '@little-galaxy/shared';
import ObjectPreview from './ObjectPreview';
export function renderSpecimen(object: MemoryObject): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1080px;height:1080px;pointer-events:none;';
    document.body.append(host);
    const root = createRoot(host);
    const cleanup = () => { clearTimeout(timeout); root.unmount(); host.remove(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('3D capture timed out')); }, 15000);
    root.render(<ObjectPreview draft={object} identity={object.id} departed={[]} onCapture={(canvas) => {
      setTimeout(() => { cleanup(); resolve(canvas); }, 0);
    }}/>);
  });
}
