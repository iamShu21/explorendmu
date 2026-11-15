// The live directory demo: the app's 51 place info cards, each linked to its walked route where one exists.
import cards from './info-cards.json';
import routes from './routes.gen.json';

// Which routed place (campus-network.json) each info card belongs to. The two files name places differently,
// so the link is written out by hand. Cards that are not listed have a card in the app but no AR route.
const PLACE_OF: Record<string, string> = {
  'Alumni Center': 'Alumni Center',
  'Audio Visual Room 3 (AVR 3 San Lorenzo Ruiz Hall)': 'Audio Visual Room 3',
  'Bro. James Maurus Doherty Hall': 'Bro. James Maurus Doherty Hall',
  'SMC Hall': 'SMC Hall',
  'University Canteen': 'University Canteen',
  'University Gymnasium': 'University Gym',
  'CEAC Faculty Office': 'CEAC Faculty Office',
  'Gate 03 (Pantua Gate)': 'Gate 03',
  'Gate 04 (Sucayan Gate)': 'Gate 04',
  'Main School Entrance (Alunan Gate)': 'Gate 02',
  'Physical Plant Office': 'Physical Plant Office',
  'University Clinic': 'Clinic',
  'University Library': 'Library',
  'Bookroom Store (Bro. Renato B. Cruz Hall)': 'Book Room',
  'Business Office (Bro. Renato B. Cruz Hall)': 'Business Office',
  'CED Faculty Office (San Lorenzo Ruiz Hall)': 'CED Faculty Office',
  'Gender And Human Development Office (GHAD)': 'GHAD',
  'Human Resource Office': 'HR and ID Room',
  'I.D. Room': 'HR and ID Room',
  'Management Information Systems Office (MIS)': 'MIS',
  'Muslim Prayer Room (Musallah) (Bro. Xavier Creegan Hall)': 'Muslim Prayer Room',
  'OMNIANA Office (Bro. Herbert Daniel Dumont Hall)': 'Omniana Office',
  'Parents Employees Council (PEC) (Bro. Herbert Daniel Dumont Hall)': 'PEC',
  'QAPS Office': 'QAPS',
  'Reviewing Stand (Bro. Herbert Daniel Dumont Hall Area)': 'Reviewing Stand',
  'Vice President Administration Office': 'Office of the Vice President',
  'Champagnat Community College': 'CCC',
  'CMRE / SMC Chapel': 'CMRE Office',
  'College of Law Dean Office (San Lorenzo Ruiz Hall)': 'Law School Office',
  'Medical Technology Department': 'Medtech Laboratory',
  'ROTC Office / Soil Laboratory': 'ROTC Unit HQ',
  'Student Supreme Government Office': 'SSG Office',
  'Teston Hall': 'Teston Hall',
  'Bro. Louis Omer Dupres Hall': 'Omer Hall',
};

// "Business Office (Bro. Renato B. Cruz Hall)" -> name "Business Office", where "Bro. Renato B. Cruz Hall".
// Brackets that are part of the name itself, like "(GHAD)" or "(Musallah)", stay in the name.
const split = (full: string) => {
  const m = full.match(/^(.*?)\s*\(([^()]*(?:Hall|Gymnasium|Gate)(?: Area)?)\)\s*$/);
  return m ? { name: m[1], where: m[2] } : { name: full, where: '' };
};

type Route = { from: string; walks: number; metres?: number; d: string };
export interface Entry { id: number; name: string; where: string; about: string; schedule: string[]; services: string[]; gate: boolean; route: Route | null; routeText: string; }

export const entries: Entry[] = cards.cards.map((c, id) => {
  const { name, where } = split(c.name);
  const place = PLACE_OF[c.name];
  const gate = !!place && /^Gate \d+$/.test(place);
  const route = (place && (routes.routes as Record<string, Route>)[place]) || null;
  const routeText = gate
    ? 'A gate: AR routes start here'
    : route
      ? route.metres
        ? `AR route from ${route.from}, ${route.metres} m as walked`
        : `AR route from ${route.from}, joined from ${route.walks} walked routes`
      : 'Information card only';
  return { id, name, where, about: c.about, schedule: c.schedule ?? [], services: c.services ?? [], gate, route, routeText };
});
export const withRoute = entries.filter((e) => e.route || e.gate).length;
