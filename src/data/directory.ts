// The live directory demo. It lists exactly the entries of the app's BuildingDirectory, in the app's order,
// each with its place card and, where the team walked one, its route.
import cards from './info-cards.json';
import appCards from './info-cards-app.json';
import routes from './routes.gen.json';
import { FACTS } from '../config';

// [entry in the app's directory, the card that holds its text, the routed place in campus-network.json (or '')]
// The three files name places differently, so the links are written out by hand.
const DIRECTORY: [string, string, string][] = [
  ['Alumni Center', 'Alumni Center', 'Alumni Center'],
  ['Audio Visual Room 3', 'Audio Visual Room 3 (AVR 3 San Lorenzo Ruiz Hall)', 'Audio Visual Room 3'],
  ['Book Room', 'Bookroom Store (Bro. Renato B. Cruz Hall)', 'Book Room'],
  ['Business Office', 'Business Office (Bro. Renato B. Cruz Hall)', 'Business Office'],
  ['CASSC Office', 'CASSC Office', 'CASSC Office'],
  ['CEAC Faculty Office', 'CEAC Faculty Office', 'CEAC Faculty Office'],
  ['CED Faculty Office', 'CED Faculty Office (San Lorenzo Ruiz Hall)', 'CED Faculty Office'],
  ['Clinic', 'University Clinic', 'Clinic'],
  ['CMRE Office', 'CMRE / SMC Chapel', 'CMRE Office'],
  ['GHAD', 'Gender And Human Development Office (GHAD)', 'GHAD'],
  ['Bro. James Maurus Doherty Hall', 'Bro. James Maurus Doherty Hall', 'Bro. James Maurus Doherty Hall'],
  ['HR (Human Resource Office)', 'Human Resource Office', 'HR and ID Room'],
  ['ID Room', 'I.D. Room', 'HR and ID Room'],
  ['Library', 'University Library', 'Library'],
  ['Medtech Laboratory', 'Medical Technology Department', 'Medtech Laboratory'],
  ['MIS', 'Management Information Systems Office (MIS)', 'MIS'],
  ['Muslim Prayer Room', 'Muslim Prayer Room (Musallah) (Bro. Xavier Creegan Hall)', 'Muslim Prayer Room'],
  ['Office of the Vice President', 'Vice President Administration Office', 'Office of the Vice President'],
  ['Omniana Office', 'OMNIANA Office (Bro. Herbert Daniel Dumont Hall)', 'Omniana Office'],
  ['OSAD', 'OSAD (Office of Student Affairs and Development)', 'OSAD'],
  ['PEC', 'Parents Employees Council (PEC) (Bro. Herbert Daniel Dumont Hall)', 'PEC'],
  ['Physical Plant Office', 'Physical Plant Office', 'Physical Plant Office'],
  ['QAPS', 'QAPS Office', 'QAPS'],
  ['Records Section', 'Records Section', 'Records Section'],
  ['Reviewing Stand', 'Reviewing Stand (Bro. Herbert Daniel Dumont Hall Area)', 'Reviewing Stand'],
  ['SMC Hall', 'SMC Hall', 'SMC Hall'],
  ['CCC (Champagnat Community College)', 'Champagnat Community College', 'CCC'],
  ['SSG Office', 'Student Supreme Government Office', 'SSG Office'],
  ['University Canteen', 'University Canteen', 'University Canteen'],
  ['University Gymnasium', 'University Gymnasium', 'University Gym'],
  ['Bro. Louis Omer Dupres Hall (Omer Hall)', 'Bro. Louis Omer Dupres Hall', 'Omer Hall'],
  ['Teston Hall', 'Teston Hall', 'Teston Hall'],
  ['Bro. Herbert Daniel Dumont Hall', 'Bro. Herbert Daniel Dumont Hall', ''],
  ['Bro. Renato B. Cruz Hall', 'Bro. Renato B. Cruz Hall', ''],
  ['Bro. Xavier Creegan Hall', 'Bro. Xavier Creegan Hall', ''],
  ['San Lorenzo Ruiz Hall', 'San Lorenzo Ruiz Hall', ''],
  ['ROTC Unit HQ', 'ROTC Office / Soil Laboratory', 'ROTC Unit HQ'],
  ['Law School Office', 'College of Law Dean Office (San Lorenzo Ruiz Hall)', 'Law School Office'],
  ['Gate 01 (Main Gate)', 'Gate 01 (Main Gate)', 'Gate 01'],
  ['Gate 02 (Alunan Gate)', 'Main School Entrance (Alunan Gate)', 'Gate 02'],
  ['Gate 03 (Pantua Gate)', 'Gate 03 (Pantua Gate)', 'Gate 03'],
  ['Gate 04 (Sucayan Gate)', 'Gate 04 (Sucayan Gate)', 'Gate 04'],
];

// "Business Office (Bro. Renato B. Cruz Hall)" -> name "Business Office", where "Bro. Renato B. Cruz Hall".
// Brackets that are part of the name itself, like "(GHAD)" or "(Musallah)", stay in the name.
const split = (full: string) => {
  const m = full.match(/^(.*?)\s*\(([^()]*(?:Hall|Gymnasium|Gate)(?: Area)?)\)\s*$/);
  return m ? { name: m[1], where: m[2] } : { name: full, where: '' };
};

type Card = { name: string; about: string; services?: string[]; schedule?: string[] };
type Route = { from: string; walks: number; metres?: number; d: string };
export interface Entry { id: number; name: string; where: string; about: string; schedule: string[]; services: string[]; gate: boolean; route: Route | null; routeText: string; }

const allCards: Card[] = [...cards.cards, ...appCards.cards];
export const entries: Entry[] = DIRECTORY.map(([appName, cardName, place], id) => {
  const card = allCards.find((c) => c.name === cardName);
  if (!card) throw new Error(`No place card named "${cardName}" for the directory entry "${appName}"`);
  const gate = /^Gate \d+$/.test(place);
  // Gates are shown under their gate number, as in the app. Every other place keeps the name on its card.
  const { name, where } = gate ? split(appName) : split(card.name);
  const route = (place && (routes.routes as Record<string, Route>)[place]) || null;
  const routeText = gate
    ? 'A gate: AR routes start here'
    : route
      ? route.metres
        ? `AR route from ${route.from}, ${route.metres} m as walked`
        : `AR route from ${route.from}, joined from ${route.walks} walked routes`
      : 'Information card only';
  return { id, name, where, about: card.about, schedule: card.schedule ?? [], services: card.services ?? [], gate, route, routeText };
});
export const withRoute = entries.filter((e) => e.route || e.gate).length;
if (entries.length !== FACTS.directoryPlaces) throw new Error(`The directory has ${entries.length} entries but FACTS.directoryPlaces says ${FACTS.directoryPlaces}`);
