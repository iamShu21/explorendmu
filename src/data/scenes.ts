// The page is a route; each scene is a junction on it.
// `dwell` (seconds, Normal pace) is how long the auto-scroll tour rests on a scene;
// `travel` is how long it takes to scroll through a pinned scene. Fast mode divides both by 2.5.
export interface Scene { id: string; title: string; dwell?: number; travel?: number; }
export const scenes: Scene[] = [
  { id: 'top', title: 'Start', dwell: 5 },
  { id: 'problem', title: 'The problem', dwell: 6 },
  { id: 'follow', title: 'Follow the arrows', travel: 16 },
  { id: 'walk', title: 'Scroll to walk', travel: 26 },
  { id: 'hear', title: 'Hear every turn', travel: 16 },
  { id: 'arrive', title: 'Arrive and learn', travel: 14 },
  { id: 'find', title: 'Find any place', dwell: 9 },
  { id: 'tour', title: 'Take the campus tour', dwell: 8 },
  { id: 'statues', title: 'Scan a statue in 3D', dwell: 10 },
  { id: 'places', title: 'Places on campus', travel: 18 },
  { id: 'walks', title: 'Built from real walks', dwell: 8 },
  { id: 'film', title: 'Watch the film', dwell: 6 },
  { id: 'how', title: 'How it works', dwell: 10 },
  { id: 'team', title: 'Team and adviser', dwell: 6 },
  { id: 'download', title: 'You have arrived', dwell: 8 },
];
export const total = scenes.length;
export const numberOf = (id: string) => String(scenes.findIndex((s) => s.id === id) + 1).padStart(2, '0');
