// Sets up every scene below the hero, in page order (ScrollTriggers must be created top to bottom).
import { initFollow, initWalk, initHear, initArrive } from './story.js';
import { initProblem } from './problem.js';
import { initFind } from './find.js';
import { initStatues } from './statues.js';

export function initScenes(ctx) {
  initProblem(ctx);
  initFollow(ctx);
  initWalk(ctx);
  initHear(ctx);
  initArrive(ctx);
  initFind(ctx);
  initStatues(ctx);
}
