/* global document, window, getComputedStyle, innerWidth, innerHeight, NodeFilter */
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
    const controlRoot=document.querySelector('dialog[open]')||document;
    const controls = [...controlRoot.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
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
    const alpha = color => {
      const match = /rgba?\(([^)]+)\)/u.exec(color || '');
      if (!match) return 0;
      const parts = match[1].split(',').map(part => Number(part));
      return parts.length < 4 ? 1 : parts[3];
    };
    const chrome = el => {
      const style = getComputedStyle(el);
      return alpha(style.backgroundColor) >= 0.08 || (parseFloat(style.borderTopWidth) || 0) >= 1
        || (style.backgroundImage && style.backgroundImage !== 'none')
        || (style.backdropFilter && style.backdropFilter !== 'none')
        || (style.boxShadow && style.boxShadow !== 'none');
    };
    const inkBox = el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0.5 && rect.height > 0.5) return rect;
      return el.getBoundingClientRect();
    };
    const pageControls = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
      .map(el => ({el, box: visibleBox(el)})).filter(item => item.box);
    // A control with no painted face is only as big as its ink. Invisible padding is not a target.
    const painted = innerWidth > 600 ? [] : pageControls.filter(({el}) => {
      const faced = chrome(el);
      const rect = faced ? el.getBoundingClientRect() : inkBox(el);
      const textOnly = el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' && !el.querySelector('svg, img, canvas');
      return rect.width < 43.99 || rect.height < 43.99 || (textOnly && !faced);
    }).map(({el}) => {
      const rect = chrome(el) ? el.getBoundingClientRect() : inkBox(el);
      return {name: name(el), width: Math.round(rect.width), height: Math.round(rect.height)};
    });
    const splitWords = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      if (!text || !/\S/u.test(text) || !visibleBox(node.parentElement)) continue;
      const range = document.createRange();
      for (const match of text.matchAll(/\S+/gu)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const tops = new Set([...range.getClientRects()].filter(rect => rect.width > 0.5 && rect.height > 0.5).map(rect => Math.round(rect.top)));
        if (tops.size > 1) splitWords.push(match[0]);
      }
    }
    const dialogHits = [];
    for (const dialog of document.querySelectorAll('dialog[open]')) {
      const box = dialog.getBoundingClientRect();
      for (const {el, box: control} of pageControls) {
        if (!dialog.contains(el) && intersects(box, control)) dialogHits.push([name(dialog), name(el)]);
      }
      const scrim = document.getElementById('recordScrim');
      const dimmed = scrim && visibleBox(scrim) && alpha(getComputedStyle(scrim).backgroundColor) >= 0.45;
      if (!dimmed) dialogHits.push([name(dialog), 'page is not dimmed']);
    }
    return {
      overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth,
      overlaps,
      small: innerWidth > 600 ? [] : controls.filter(({el}) => {
        const rect = el.getBoundingClientRect(); return rect.width < 43.99 || rect.height < 43.99;
      }).map(({el}) => ({name: name(el), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height})),
      painted,
      // The timelapse action belongs inside the notice; all other controls must stay clear.
      noticeIntersections: noteBox ? controls.filter(({el, box}) => !note.contains(el) && intersects(noteBox, box)).map(({el}) => name(el)) : [],
      brokenWords,
      splitWords,
      dialogHits,
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
  expect(layout.painted, `${state}: phone touch target under 44px`).toEqual([]);
  expect(layout.noticeIntersections, `${state}: notice intersects controls`).toEqual([]);
  expect(layout.brokenWords, `${state}: a title word wraps across lines`).toEqual([]);
  expect(layout.splitWords, `${state}: a visible label breaks inside a word`).toEqual([]);
  expect(layout.dialogHits, `${state}: a dialog collides with the page`).toEqual([]);
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
