/* global document, window, getComputedStyle, innerWidth, innerHeight */
import {expect} from '@playwright/test';

export async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Wait for actual UI transitions, excluding continuously running sky ornaments.
    await Promise.all(document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().iterations !== Infinity,
    ).map(animation => animation.finished.catch(() => {})));
  });
}

export async function measureLayout(page) {
  return page.evaluate(() => {
    const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5;
    function visibleBox(el) {
      const rect = el.getBoundingClientRect();
      const box = {left: Math.max(0, rect.left), top: Math.max(0, rect.top),
        right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom)};
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
        if (node !== el) {
          const parent = node.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/u.test(style.overflowX)) {
            box.left = Math.max(box.left, parent.left); box.right = Math.min(box.right, parent.right);
          }
          if (/(auto|scroll|hidden|clip)/u.test(style.overflowY)) {
            box.top = Math.max(box.top, parent.top); box.bottom = Math.min(box.bottom, parent.bottom);
          }
        }
      }
      return box.right > box.left && box.bottom > box.top ? box : null;
    }
    const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
      .map(el => ({el, box: visibleBox(el)})).filter(item => item.box);
    const name = el => el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 60);
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (intersects(a.box, b.box)) overlaps.push([name(a.el), name(b.el)]);
    }
    // Title letters are inline-blocks (for their entrance animation), so a box narrower than a word splits it.
    const brokenWords = [...document.querySelectorAll('.splash-title span')].filter(span => visibleBox(span)
      && new Set([...span.querySelectorAll('i')].map(letter => Math.round(letter.getBoundingClientRect().top))).size > 1)
      .map(span => span.textContent);
    const note = document.getElementById('sharedStatus');
    const noteBox = note && visibleBox(note);
    return {
      overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth,
      overlaps,
      small: innerWidth > 600 ? [] : controls.filter(({el}) => {
        const rect = el.getBoundingClientRect(); return rect.width < 43.99 || rect.height < 43.99;
      }).map(({el}) => ({name: name(el), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height})),
      // The timelapse action belongs inside the notice; all other controls must stay clear.
      noticeIntersections: noteBox ? controls.filter(({el, box}) => !note.contains(el) && intersects(noteBox, box)).map(({el}) => name(el)) : [],
      brokenWords,
      controls: controls.length,
    };
  });
}

export async function expectLayout(page, state) {
  await settleLayout(page);
  const layout = await measureLayout(page);
  expect(layout.controls, `${state}: expected visible controls`).toBeGreaterThan(0);
  expect(layout.overflow, `${state}: horizontal overflow`).toBe(false);
  expect(layout.overlaps, `${state}: intersecting controls`).toEqual([]);
  expect(layout.small, `${state}: phone touch targets below 44px`).toEqual([]);
  expect(layout.noticeIntersections, `${state}: notice intersects controls`).toEqual([]);
  expect(layout.brokenWords, `${state}: a title word wraps across lines`).toEqual([]);
  return layout;
}

// Choose a stable orbit using the existing development readouts, then use real pointer input.
// An escaping trajectory has no immediate result sheet, so it cannot audit that state.
export async function aimCircularBody(page) {
  const {start, pull} = await page.evaluate(() => {
    const world = window.__fog.world;
    const {anchor, host, vc} = world.launchInfo();
    const start = world.project(world.benchBody.root.position);
    return {start: {x: start.x, y: start.y}, pull: world.pullFor(-(anchor[2] - host[2]), anchor[0] - host[0], vc)};
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + pull.x, start.y + pull.y, {steps: 8});
  await expect.poll(() => page.evaluate(() => window.__fog.world.aimState.pred?.outcome)).toBe('orbit');
}
