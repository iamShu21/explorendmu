// Every scene below the hero, in page order (ScrollTriggers must be created top to bottom).
// main.js runs these one per task, so no single step holds up the page.
import { initFollow, initWalk, initHear, initArrive } from './story.js';
import { initProblem } from './problem.js';
import { initFind } from './find.js';
import { initStatues } from './statues.js';
import { initPlaces, initWalks, initFilm, initArrival, initApkCount } from './more.js';

export const sceneSteps = [initProblem, initFollow, initWalk, initHear, initArrive, initFind, initStatues, initPlaces, initWalks, initFilm, initArrival, initApkCount];
