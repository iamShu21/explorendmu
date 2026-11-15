// The problem: three real campus photos drift at different speeds as the scene passes.
import { gsap, env, $$ } from '../core.js';

export function initProblem() {
  if (env.reduced) return;
  $$('[data-parallax]').forEach((el, i) => {
    gsap.fromTo(el, { y: 40 + i * 34 }, { y: -(30 + i * 30), ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}
