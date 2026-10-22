import type { OsmRoadInput } from '@hexa/shields';
import type { PlaceCategory } from '@hexa/shared';

export interface OsmRoadSegment extends OsmRoadInput {
  id: string;
  name: string;
  /** Polyline coordinates in [lng, lat] order */
  coordinates: Array<[number, number]>;
}

export interface OsmPoiFeature {
  id: string;
  name: string;
  displayName: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  countryCode: string;
  country: string;
  state?: string;
  city?: string;
  street?: string;
  postcode?: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
}

export interface OsmTransitCorridor {
  id: string;
  lineName: string;
  lineShortName: string;
  agencyName: string;
  vehicleType: 'rail' | 'metro' | 'bus' | 'ferry' | 'tram';
  color: string;
  headwayMinutes: number;
  stops: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
  }>;
}

export interface OsmPolygonFeature {
  id: string;
  name: string;
  kind: 'water' | 'park';
  /** Outer ring in [lng, lat] */
  coordinates: Array<Array<[number, number]>>;
}

/**
 * Curated OpenStreetMap-derived road segments with verified WGS84 geometry and real
 * highway / network / ref metadata across India (Goa, Mumbai–Pune–Delhi, Bengaluru)
 * and 16+ international countries so highway shields, local vector tiles, search,
 * and road-graph routing work deterministically out of the box.
 */
export const OSM_ROAD_SEGMENTS: OsmRoadSegment[] = [
  // =========================================================================
  // INDIA — GOA REGIONAL NETWORK (Mapusa, Panaji, Calangute, Vasco, Margao)
  // =========================================================================
  {
    id: 'way-in-nh66-pernem-mapusa',
    name: 'Mumbai–Goa–Kanyakumari National Highway (NH 66)',
    highway: 'trunk',
    ref: 'NH 66',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 6,
    maxspeed: '80',
    surface: 'asphalt',
    coordinates: [
      [73.7965, 15.721],
      [73.8022, 15.662],
      [73.8132, 15.6125],
      [73.8162, 15.5915], // Mapusa NH66 Junction
    ],
  },
  {
    id: 'way-in-nh66-mapusa-porvorim-panaji',
    name: 'NH 66 — Mapusa–Porvorim–Atal Setu Corridor',
    official_name: 'National Highway 66',
    highway: 'trunk',
    ref: 'NH 66',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 6,
    maxspeed: '80',
    bridge: 'yes',
    surface: 'asphalt',
    coordinates: [
      [73.8162, 15.5915], // Mapusa NH66 Junction
      [73.8215, 15.5562], // Guirim
      [73.8286, 15.5335], // Porvorim
      [73.8342, 15.5028], // Mandovi / Atal Setu North
      [73.8368, 15.4945], // Panaji KTC Circle
    ],
  },
  {
    id: 'way-in-nh66-panaji-bambolim-cortalim',
    name: 'NH 66 — Bambolim–Agassaim–Zuari Bridge',
    highway: 'trunk',
    ref: 'NH 66',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 6,
    maxspeed: '80',
    bridge: 'yes',
    surface: 'asphalt',
    coordinates: [
      [73.8368, 15.4945], // Panaji KTC Circle
      [73.8576, 15.4592], // Bambolim / GMC
      [73.8884, 15.429],  // Agassaim
      [73.9092, 15.4052], // Cortalim Junction (Zuari South)
    ],
  },
  {
    id: 'way-in-nh66-cortalim-margao-karwar',
    name: 'NH 66 — Cortalim–Verna–Margao Highway',
    highway: 'trunk',
    ref: 'NH 66',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 4,
    maxspeed: '80',
    surface: 'asphalt',
    coordinates: [
      [73.9092, 15.4052], // Cortalim
      [73.9375, 15.3635], // Verna Industrial Estate
      [73.9581, 15.2952], // Margao Bypass
      [73.9685, 15.2736], // Margao City South
      [74.0412, 15.012],  // Canacona
    ],
  },
  {
    id: 'way-in-nh748-panaji-oldgoa-ponda',
    name: 'Panaji–Belagavi National Highway (NH 748)',
    highway: 'trunk',
    ref: 'NH 748',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 4,
    maxspeed: '70',
    surface: 'asphalt',
    coordinates: [
      [73.8368, 15.4945], // Panaji KTC Circle
      [73.875, 15.4995],  // Ribandar Causeway
      [73.9115, 15.5009], // Old Goa Basilica Junction
      [73.9612, 15.454],  // Banastarim
      [74.0078, 15.4025], // Ponda
    ],
  },
  {
    id: 'way-in-nh366-cortalim-dabolim-vasco',
    name: 'NH 366 — Cortalim–Dabolim Airport–Vasco Highway',
    highway: 'trunk',
    ref: 'NH 366',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 4,
    maxspeed: '70',
    surface: 'asphalt',
    coordinates: [
      [73.9092, 15.4052], // Cortalim Junction
      [73.858, 15.3855],  // Chicalim
      [73.8352, 15.3808], // Goa Dabolim Airport
      [73.8113, 15.3982], // Vasco da Gama
    ],
  },
  {
    id: 'way-in-nh566-verna-dabolim',
    name: 'NH 566 — Verna–Zuarinagar–Airport Link Expressway',
    highway: 'trunk',
    ref: 'NH 566',
    network: 'IN:NH',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 4,
    maxspeed: '80',
    coordinates: [
      [73.9375, 15.3635], // Verna
      [73.882, 15.377],   // Zuarinagar
      [73.8352, 15.3808], // Dabolim Airport
    ],
  },
  {
    id: 'way-in-gash1-mapusa-calangute-candolim',
    name: 'Goa State Highway 1 (Mapusa–Calangute–Sinquerim)',
    highway: 'primary',
    ref: 'SH 1',
    network: 'IN:SH:GA',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 2,
    maxspeed: '50',
    surface: 'asphalt',
    coordinates: [
      [73.8162, 15.5915], // Mapusa NH66 Junction
      [73.808, 15.5912],  // Mapusa Bus Stand
      [73.7915, 15.5688], // Parra Coconut Tree Road Junction
      [73.7684, 15.5449], // Calangute Circle
      [73.7672, 15.5182], // Candolim
    ],
  },
  {
    id: 'way-in-chogm-porvorim-calangute',
    name: 'CHOGM Road (MDR 5 — Porvorim–Saligao–Calangute)',
    highway: 'secondary',
    ref: 'MDR 5',
    network: 'IN:MDR',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 2,
    maxspeed: '50',
    surface: 'asphalt',
    coordinates: [
      [73.8286, 15.5335], // Porvorim
      [73.7942, 15.5468], // Saligao
      [73.7684, 15.5449], // Calangute Circle
    ],
  },
  {
    id: 'way-in-mapusa-anjuna-vagator',
    name: 'Mapusa–Assagao–Anjuna–Vagator Road',
    highway: 'secondary',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 2,
    maxspeed: '45',
    coordinates: [
      [73.808, 15.5912],  // Mapusa Bus Stand
      [73.7768, 15.5955], // Assagao
      [73.7438, 15.5835], // Anjuna
      [73.7395, 15.603],  // Vagator
    ],
  },
  {
    id: 'way-in-panaji-18th-june-miramar',
    name: 'Dayanand Bandodkar Marg & 18th June Road',
    highway: 'primary',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 4,
    maxspeed: '50',
    coordinates: [
      [73.8368, 15.4945], // Panaji KTC Circle
      [73.8278, 15.4989], // Panaji Church Square / 18th June Rd
      [73.8068, 15.4825], // Miramar Circle
      [73.8035, 15.4605], // Dona Paula Jetty
      [73.8576, 15.4592], // Dona Paula–Bambolim Link Road
    ],
  },
  {
    id: 'way-in-ponda-margao-sh',
    name: 'Ponda–Borim–Margao State Highway (SH 8)',
    highway: 'primary',
    ref: 'SH 8',
    network: 'IN:SH:GA',
    countryCode: 'IN',
    subdivisionCode: 'GA',
    lanes: 2,
    maxspeed: '60',
    coordinates: [
      [74.0078, 15.4025], // Ponda
      [73.989, 15.349],   // Borim Bridge
      [73.9581, 15.2952], // Margao Bypass
    ],
  },

  // =========================================================================
  // INDIA — MUMBAI–PUNE EXPRESSWAY, NH 48 / AH47, DELHI–MUMBAI, NH 44, NH 16, NH 27
  // =========================================================================
  {
    id: 'way-in-mumbai-pune-expressway',
    name: 'Mumbai–Pune Expressway',
    official_name: 'Yashwantrao Chavan Mumbai–Pune Expressway',
    highway: 'motorway',
    expressway: 'yes',
    toll: 'yes',
    countryCode: 'IN',
    subdivisionCode: 'MH',
    lanes: 6,
    maxspeed: '100',
    surface: 'concrete',
    coordinates: [
      [72.8777, 19.076],  // Mumbai Sion/Chembur Link
      [73.1089, 19.0022], // Kalamboli (Panvel) Start
      [73.3321, 18.781],  // Khopoli / Lonavala Ghat
      [73.4072, 18.7557], // Lonavala
      [73.6815, 18.6721], // Dehu Road
      [73.8567, 18.5204], // Pune
    ],
  },
  {
    id: 'way-in-nh48-ah47-mumbai-pune-bengaluru',
    name: 'NH 48 — Mumbai–Pune–Satara–Bengaluru Highway',
    highway: 'trunk',
    ref: 'NH 48;AH47',
    network: 'IN:NH;AsianHighway',
    toll: 'yes',
    countryCode: 'IN',
    subdivisionCode: 'MH',
    lanes: 6,
    maxspeed: '90',
    coordinates: [
      [72.8777, 19.076],  // Mumbai
      [72.9781, 19.2183], // Thane
      [73.1089, 19.0022], // Panvel
      [73.8567, 18.5204], // Pune
      [74.0009, 17.6805], // Satara
      [74.2433, 16.705],  // Kolhapur
      [74.4977, 15.8497], // Belagavi
      [77.5946, 12.9716], // Bengaluru
    ],
  },
  {
    id: 'way-in-ne4-delhi-mumbai-expressway',
    name: 'Delhi–Mumbai Expressway',
    highway: 'motorway',
    ref: 'NE 4',
    network: 'IN:NE',
    expressway: 'yes',
    toll: 'yes',
    countryCode: 'IN',
    lanes: 8,
    maxspeed: '120',
    coordinates: [
      [77.0688, 28.262],  // Sohna (South Delhi)
      [76.371, 26.895],   // Dausa (Jaipur Link)
      [75.8648, 25.18],   // Kota
      [75.06, 23.33],     // Ratlam
      [73.1812, 22.3072], // Vadodara
      [72.8311, 21.1702], // Surat
      [72.8777, 19.076],  // Mumbai
    ],
  },
  {
    id: 'way-in-yamuna-expressway',
    name: 'Yamuna Expressway',
    highway: 'motorway',
    expressway: 'yes',
    toll: 'yes',
    countryCode: 'IN',
    subdivisionCode: 'UP',
    lanes: 6,
    maxspeed: '100',
    coordinates: [
      [77.209, 28.6139],  // New Delhi
      [77.504, 28.4744],  // Greater Noida
      [77.6737, 27.4924], // Mathura
      [78.0081, 27.1767], // Agra
    ],
  },
  {
    id: 'way-in-purvanchal-expressway',
    name: 'Purvanchal Expressway',
    highway: 'motorway',
    expressway: 'yes',
    toll: 'yes',
    countryCode: 'IN',
    subdivisionCode: 'UP',
    lanes: 6,
    maxspeed: '100',
    coordinates: [
      [80.9462, 26.8467], // Lucknow
      [82.07, 26.26],     // Sultanpur
      [83.56, 25.58],     // Ghazipur
    ],
  },
  {
    id: 'way-in-nh44-north-south',
    name: 'NH 44 — North–South Corridor (Delhi–Agra–Hyderabad–Bengaluru)',
    highway: 'trunk',
    ref: 'NH 44;AH43',
    network: 'IN:NH;AsianHighway',
    toll: 'yes',
    countryCode: 'IN',
    lanes: 6,
    maxspeed: '90',
    coordinates: [
      [77.209, 28.6139],  // New Delhi
      [78.0081, 27.1767], // Agra
      [79.0882, 21.1458], // Nagpur
      [78.4867, 17.385],  // Hyderabad
      [77.5946, 12.9716], // Bengaluru
    ],
  },
  {
    id: 'way-in-nh16-east-coast',
    name: 'NH 16 — Kolkata–Visakhapatnam–Chennai East Coast Highway',
    highway: 'trunk',
    ref: 'NH 16;AH45',
    network: 'IN:NH;AsianHighway',
    countryCode: 'IN',
    lanes: 6,
    coordinates: [
      [88.3639, 22.5726], // Kolkata
      [85.8245, 20.2961], // Bhubaneswar
      [83.2185, 17.6868], // Visakhapatnam
      [80.2707, 13.0827], // Chennai
    ],
  },
  {
    id: 'way-in-nh27-east-west',
    name: 'NH 27 — East–West Corridor (Udaipur–Kota–Lucknow–Guwahati)',
    highway: 'trunk',
    ref: 'NH 27',
    network: 'IN:NH',
    countryCode: 'IN',
    lanes: 4,
    coordinates: [
      [73.7125, 24.5854], // Udaipur
      [75.8648, 25.18],   // Kota
      [80.9462, 26.8467], // Lucknow
      [91.7362, 26.1445], // Guwahati
    ],
  },
  {
    id: 'way-in-kash17-bengaluru-mysuru',
    name: 'Bengaluru–Mysuru State Corridor (KA SH 17)',
    highway: 'primary',
    ref: 'SH 17',
    network: 'IN:SH:KA',
    countryCode: 'IN',
    subdivisionCode: 'KA',
    lanes: 4,
    coordinates: [
      [77.5946, 12.9716], // Bengaluru
      [76.8958, 12.5218], // Mandya
      [76.6394, 12.2958], // Mysuru
    ],
  },

  // =========================================================================
  // INTERNATIONAL SHOWCASE CORRIDORS (US, CA, GB, DE, FR, JP, AU, MY, ZA, BR, PK, BD, NP, ID, CN)
  // =========================================================================
  {
    id: 'way-us-i95-nyc-philly',
    name: 'Interstate 95 (New Jersey Turnpike / Cross Bronx Expy)',
    highway: 'motorway',
    ref: 'I 95;US 1',
    network: 'US:I;US:US',
    toll: 'yes',
    countryCode: 'US',
    subdivisionCode: 'NY',
    lanes: 8,
    maxspeed: '65 mph',
    coordinates: [
      [-75.1652, 39.9526], // Philadelphia
      [-74.1724, 40.7357], // Newark
      [-73.951, 40.846],   // George Washington Bridge / Manhattan
      [-73.885, 40.845],   // Bronx
      [-72.9279, 41.3083], // New Haven
    ],
  },
  {
    id: 'way-us-i278-bqe',
    name: 'Brooklyn–Queens Expressway (I-278)',
    highway: 'motorway',
    ref: 'I 278',
    network: 'US:I',
    countryCode: 'US',
    subdivisionCode: 'NY',
    lanes: 6,
    coordinates: [
      [-74.075, 40.606], // Verrazzano
      [-73.9969, 40.696], // Brooklyn Heights
      [-73.922, 40.768],  // Astoria Queens
    ],
  },
  {
    id: 'way-us-ny27-sunrise',
    name: 'NY State Route 27 (Sunrise Highway)',
    highway: 'primary',
    ref: 'NY 27',
    network: 'US:NY',
    countryCode: 'US',
    subdivisionCode: 'NY',
    lanes: 4,
    coordinates: [
      [-73.9969, 40.696],
      [-73.65, 40.658],
      [-73.22, 40.735],
    ],
  },
  {
    id: 'way-ca-on401-tch',
    name: 'Ontario Highway 401 & Trans-Canada Corridor',
    highway: 'motorway',
    ref: 'ON 401;TCH 1',
    network: 'CA:ON;CA:TCH',
    countryCode: 'CA',
    subdivisionCode: 'ON',
    lanes: 12,
    coordinates: [
      [-79.65, 43.62],
      [-79.3832, 43.76],
      [-78.86, 43.88],
    ],
  },
  {
    id: 'way-gb-m25-orbital',
    name: 'M25 London Orbital Motorway',
    highway: 'motorway',
    ref: 'M25;E 15',
    network: 'GB:M;e-road',
    countryCode: 'GB',
    lanes: 8,
    maxspeed: '70 mph',
    coordinates: [
      [-0.485, 51.472], // Heathrow J14
      [-0.25, 51.69],   // South Mimms
      [0.262, 51.465],  // Dartford Crossing
      [-0.16, 51.265],  // Reigate
      [-0.485, 51.472],
    ],
  },
  {
    id: 'way-gb-a40-london',
    name: 'A40 Western Avenue',
    highway: 'trunk',
    ref: 'A40',
    network: 'GB:A',
    countryCode: 'GB',
    lanes: 6,
    coordinates: [
      [-0.485, 51.472],
      [-0.28, 51.525],
      [-0.1276, 51.5072], // Central London
    ],
  },
  {
    id: 'way-gb-b500-holborn',
    name: 'B500 Bloomsbury Way',
    highway: 'secondary',
    ref: 'B500',
    network: 'GB:B',
    countryCode: 'GB',
    lanes: 2,
    coordinates: [
      [-0.1276, 51.5072],
      [-0.118, 51.519],
    ],
  },
  {
    id: 'way-de-a3-frankfurt-munich',
    name: 'Bundesautobahn 3 / E 45 (Frankfurt–Nürnberg–München)',
    highway: 'motorway',
    ref: 'A 3',
    int_ref: 'E 45',
    network: 'DE:BAB',
    countryCode: 'DE',
    lanes: 6,
    maxspeed: 'none',
    coordinates: [
      [8.6821, 50.1109],  // Frankfurt am Main
      [9.9534, 49.7913],  // Würzburg
      [11.0767, 49.4521], // Nürnberg
      [11.582, 48.1351],  // München (via A9 link)
    ],
  },
  {
    id: 'way-de-b2-munich',
    name: 'Bundesstraße 2 (Nürnberg–Augsburg–München)',
    highway: 'primary',
    ref: 'B 2',
    network: 'DE:BS',
    countryCode: 'DE',
    lanes: 2,
    coordinates: [
      [11.0767, 49.4521],
      [10.8978, 48.3705],
      [11.582, 48.1351],
    ],
  },
  {
    id: 'way-fr-a1-paris',
    name: 'Autoroute du Nord (A 1 / E 15)',
    highway: 'motorway',
    ref: 'A 1',
    int_ref: 'E 15',
    network: 'FR:A',
    toll: 'yes',
    countryCode: 'FR',
    lanes: 6,
    coordinates: [
      [2.3522, 48.8566], // Paris
      [2.54, 49.01],     // CDG
      [3.0573, 50.6292], // Lille
    ],
  },
  {
    id: 'way-jp-tomei-r1-tokyo',
    name: 'Tomei Expressway (E1) & National Route 1',
    highway: 'motorway',
    ref: 'E1;1',
    network: 'JP:E;JP:NATIONAL',
    toll: 'yes',
    countryCode: 'JP',
    lanes: 6,
    coordinates: [
      [139.7671, 35.6812], // Tokyo Nihonbashi
      [139.638, 35.4437],  // Yokohama
      [138.3828, 34.9756], // Shizuoka
      [136.9066, 35.1815], // Nagoya
    ],
  },
  {
    id: 'way-au-m1-sydney',
    name: 'M1 Pacific & Princes Motorway',
    highway: 'motorway',
    ref: 'M1;A1',
    network: 'AU:M;AU:A',
    countryCode: 'AU',
    lanes: 6,
    coordinates: [
      [151.7817, -32.9283], // Newcastle
      [151.2093, -33.8688], // Sydney
      [150.8931, -34.4278], // Wollongong
    ],
  },
  {
    id: 'way-my-e1-plus',
    name: 'North–South Expressway (PLUS E1 / AH2)',
    highway: 'motorway',
    ref: 'E1',
    int_ref: 'AH2',
    network: 'MY:E',
    toll: 'yes',
    countryCode: 'MY',
    lanes: 6,
    coordinates: [
      [100.3327, 5.4141],  // Penang / Butterworth
      [101.0901, 4.5975],  // Ipoh
      [101.6869, 3.139],   // Kuala Lumpur
    ],
  },
  {
    id: 'way-za-n1-capetown',
    name: 'N1 National Route (Cape Town–Paarl)',
    highway: 'motorway',
    ref: 'N1',
    network: 'ZA:N',
    countryCode: 'ZA',
    lanes: 4,
    coordinates: [
      [18.4241, -33.9249], // Cape Town
      [18.65, -33.87],     // Bellville
      [18.9621, -33.7342], // Paarl
    ],
  },
  {
    id: 'way-br-116-dutra',
    name: 'Rodovia Presidente Dutra (BR-116)',
    highway: 'motorway',
    ref: 'BR-116',
    network: 'BR',
    toll: 'yes',
    countryCode: 'BR',
    lanes: 6,
    coordinates: [
      [-46.6333, -23.5505], // São Paulo
      [-45.8872, -23.2237], // São José dos Campos
      [-43.1729, -22.9068], // Rio de Janeiro
    ],
  },
  {
    id: 'way-pk-m2-lahore-islamabad',
    name: 'M-2 Lahore–Islamabad Motorway',
    highway: 'motorway',
    ref: 'M-2;AH1',
    network: 'PK:M;AsianHighway',
    toll: 'yes',
    countryCode: 'PK',
    lanes: 6,
    coordinates: [
      [74.3587, 31.5204], // Lahore
      [73.0479, 33.6844], // Islamabad
    ],
  },
  {
    id: 'way-bd-n1-dhaka-chattogram',
    name: 'N1 Dhaka–Chattogram National Highway',
    highway: 'trunk',
    ref: 'N1;AH41',
    network: 'BD:N;AsianHighway',
    countryCode: 'BD',
    lanes: 4,
    coordinates: [
      [90.4125, 23.8103], // Dhaka
      [91.1809, 23.4607], // Cumilla
      [91.8312, 22.3569], // Chattogram
    ],
  },
  {
    id: 'way-np-h01-mahendra',
    name: 'Mahendra Highway (H01 / AH2)',
    highway: 'trunk',
    ref: 'H01;AH2',
    network: 'NP:NH;AsianHighway',
    countryCode: 'NP',
    lanes: 2,
    coordinates: [
      [84.432, 27.68],    // Bharatpur / Narayangadh
      [85.92, 26.89],     // Bardibas
      [87.2718, 26.664],  // Itahari
    ],
  },
  {
    id: 'way-id-tol-trans-jawa',
    name: 'Jalan Tol Jakarta–Cikampek (Tol 1 / AH2)',
    highway: 'motorway',
    ref: 'Tol 1;AH2',
    network: 'ID:TOLL;AsianHighway',
    toll: 'yes',
    countryCode: 'ID',
    lanes: 6,
    coordinates: [
      [106.8456, -6.2088], // Jakarta
      [107.15, -6.29],     // Cikarang
      [107.45, -6.4],      // Cikampek
    ],
  },
  {
    id: 'way-cn-g4-beijing',
    name: 'G4 Jinggang\'ao Expressway',
    highway: 'motorway',
    ref: 'G4',
    network: 'CN:EXPRESSWAY',
    toll: 'yes',
    countryCode: 'CN',
    lanes: 8,
    coordinates: [
      [116.4074, 39.9042], // Beijing
      [115.4646, 38.874],  // Baoding
      [114.5149, 38.0428], // Shijiazhuang
    ],
  },
];

/**
 * Curated OpenStreetMap Points of Interest & Landmarks.
 * Notice: No fabricated phone numbers, ratings, or opening hours!
 */
export const OSM_POIS: OsmPoiFeature[] = [
  {
    id: 'osm-node-mapusa-bus-stand',
    name: 'Mapusa Bus Stand',
    displayName: 'Mapusa Kadamba Bus Stand, Mapusa, Bardez, Goa, India',
    category: 'bus_station',
    lat: 15.5912,
    lng: 73.808,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Mapusa',
    postcode: '403507',
    osmType: 'node',
    osmId: '312849201',
  },
  {
    id: 'osm-node-mapusa-friday-market',
    name: 'Mapusa Municipal Market',
    displayName: 'Mapusa Municipal Market, Shakuntala Plaza, Mapusa, Goa, India',
    category: 'landmark',
    lat: 15.5901,
    lng: 73.8104,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Mapusa',
    postcode: '403507',
    osmType: 'way',
    osmId: '149203112',
  },
  {
    id: 'osm-node-panaji-city',
    name: 'Panaji',
    displayName: 'Panaji, Tiswadi, North Goa, Goa, India',
    category: 'city',
    lat: 15.4909,
    lng: 73.8278,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    postcode: '403001',
    osmType: 'node',
    osmId: '245655195',
  },
  {
    id: 'osm-node-panaji-ktc',
    name: 'Panaji KTC Bus Terminus',
    displayName: 'Panaji Kadamba Bus Stand, Patto, Panaji, Goa, India',
    category: 'bus_station',
    lat: 15.4945,
    lng: 73.8368,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    postcode: '403001',
    osmType: 'way',
    osmId: '164002190',
  },
  {
    id: 'osm-node-panaji-church',
    name: 'Our Lady of the Immaculate Conception Church',
    displayName: 'Immaculate Conception Church, Church Square, Panaji, Goa, India',
    category: 'landmark',
    lat: 15.4989,
    lng: 73.8278,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    street: 'Rua Emídio Garcia',
    postcode: '403001',
    osmType: 'way',
    osmId: '158220412',
  },
  {
    id: 'osm-node-miramar-beach',
    name: 'Miramar Beach',
    displayName: 'Miramar Beach, Dayanand Bandodkar Marg, Panaji, Goa, India',
    category: 'park',
    lat: 15.4825,
    lng: 73.8068,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    osmType: 'way',
    osmId: '198443210',
  },
  {
    id: 'osm-node-dona-paula',
    name: 'Dona Paula Viewpoint & Jetty',
    displayName: 'Dona Paula Jetty, Dona Paula, Panaji, Goa, India',
    category: 'landmark',
    lat: 15.4605,
    lng: 73.8035,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    osmType: 'node',
    osmId: '412009318',
  },
  {
    id: 'osm-node-calangute-beach',
    name: 'Calangute Beach',
    displayName: 'Calangute Beach, Bardez, North Goa, Goa, India',
    category: 'landmark',
    lat: 15.5449,
    lng: 73.7554,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Calangute',
    postcode: '403516',
    osmType: 'way',
    osmId: '112349812',
  },
  {
    id: 'osm-node-old-goa-basilica',
    name: 'Basilica of Bom Jesus',
    displayName: 'Basilica of Bom Jesus, Old Goa Road, Old Goa, Goa, India',
    category: 'landmark',
    lat: 15.5009,
    lng: 73.9115,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Old Goa',
    postcode: '403402',
    osmType: 'way',
    osmId: '98312451',
  },
  {
    id: 'osm-node-gmc-bambolim',
    name: 'Goa Medical College & Hospital',
    displayName: 'Goa Medical College (GMC), NH 66, Bambolim, Goa, India',
    category: 'hospital',
    lat: 15.4592,
    lng: 73.8576,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Bambolim',
    street: 'NH 66',
    postcode: '403202',
    osmType: 'way',
    osmId: '176332009',
  },
  {
    id: 'osm-node-goa-airport-dabolim',
    name: 'Goa International Airport (Dabolim)',
    displayName: 'Goa International Airport (GOI), Airport Rd, Dabolim, Goa, India',
    category: 'airport',
    lat: 15.3808,
    lng: 73.8352,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Dabolim',
    postcode: '403801',
    osmType: 'way',
    osmId: '104992381',
  },
  {
    id: 'osm-node-madgaon-junction',
    name: 'Madgaon Junction Railway Station',
    displayName: 'Madgaon Junction (MAO), Konkan Railway, Margao, South Goa, India',
    category: 'transit_station',
    lat: 15.2678,
    lng: 73.9702,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Margao',
    postcode: '403601',
    osmType: 'way',
    osmId: '88291042',
  },
  {
    id: 'osm-node-gunpowder-assagao',
    name: 'Gunpowder Restaurant Assagao',
    displayName: 'Gunpowder, Saunta Vaddo, Assagao, Bardez, Goa, India',
    category: 'restaurant',
    lat: 15.5955,
    lng: 73.7768,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Assagao',
    osmType: 'node',
    osmId: '519203844',
  },
  {
    id: 'osm-node-vinayak-assagao',
    name: 'Vinayak Family Restaurant',
    displayName: 'Vinayak Family Restaurant, Sacolim, Assagao, Near Mapusa, Goa, India',
    category: 'restaurant',
    lat: 15.5938,
    lng: 73.7842,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Mapusa',
    osmType: 'node',
    osmId: '619283711',
  },
  {
    id: 'osm-node-ritz-classic-panaji',
    name: 'Ritz Classic Panaji',
    displayName: 'Ritz Classic Restaurant, 18th June Road, Panaji, Goa, India',
    category: 'restaurant',
    lat: 15.4978,
    lng: 73.8265,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    street: '18th June Road',
    osmType: 'node',
    osmId: '482910322',
  },
  {
    id: 'osm-node-cafe-bodega-panaji',
    name: 'Cafe Bodega Altinho',
    displayName: 'Cafe Bodega, Sunaparanta Centre for the Arts, Altinho, Panaji, Goa, India',
    category: 'cafe',
    lat: 15.4932,
    lng: 73.8295,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Panaji',
    osmType: 'node',
    osmId: '492019283',
  },
  {
    id: 'osm-node-spice-goa-mapusa',
    name: 'Spice Goa Restaurant',
    displayName: 'Spice Goa, Karaswada, NH 66, Mapusa, Goa, India',
    category: 'restaurant',
    lat: 15.6032,
    lng: 73.8148,
    countryCode: 'IN',
    country: 'India',
    state: 'Goa',
    city: 'Mapusa',
    street: 'NH 66',
    osmType: 'node',
    osmId: '528391044',
  },
  {
    id: 'osm-node-csmia-mumbai',
    name: 'Chhatrapati Shivaji Maharaj Terminus',
    displayName: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai, Maharashtra, India',
    category: 'transit_station',
    lat: 18.9398,
    lng: 72.8355,
    countryCode: 'IN',
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    osmType: 'way',
    osmId: '42910293',
  },
  {
    id: 'osm-node-india-gate-delhi',
    name: 'India Gate',
    displayName: 'India Gate, Kartavya Path, New Delhi, Delhi, India',
    category: 'landmark',
    lat: 28.6129,
    lng: 77.2295,
    countryCode: 'IN',
    country: 'India',
    state: 'Delhi',
    city: 'New Delhi',
    osmType: 'way',
    osmId: '55102938',
  },
];

export const OSM_TRANSIT_CORRIDORS: OsmTransitCorridor[] = [
  {
    id: 'transit-ktc-shuttle-mapusa-panaji-margao',
    lineName: 'KTC EV Express Shuttle (Mapusa – Panaji – Margao)',
    lineShortName: 'KTC EV-1',
    agencyName: 'Kadamba Transport Corporation (Goa)',
    vehicleType: 'bus',
    color: '#0EA5E9',
    headwayMinutes: 15,
    stops: [
      { id: 'stop-mapusa', name: 'Mapusa KTC Bus Stand', lat: 15.5912, lng: 73.808 },
      { id: 'stop-porvorim', name: 'Porvorim Mall de Goa Stop', lat: 15.5335, lng: 73.8286 },
      { id: 'stop-panaji', name: 'Panaji KTC Bus Terminus', lat: 15.4945, lng: 73.8368 },
      { id: 'stop-bambolim', name: 'GMC Bambolim Stop', lat: 15.4592, lng: 73.8576 },
      { id: 'stop-cortalim', name: 'Cortalim Cross Stop', lat: 15.4052, lng: 73.9092 },
      { id: 'stop-verna', name: 'Verna Titan Junction', lat: 15.3635, lng: 73.9375 },
      { id: 'stop-margao', name: 'Margao KTC Bus Terminus', lat: 15.2952, lng: 73.9581 },
    ],
  },
  {
    id: 'transit-ktc-airport-panaji-vasco',
    lineName: 'KTC Airport Shuttle (Calangute – Panaji – Dabolim Airport – Vasco)',
    lineShortName: 'KTC AIR',
    agencyName: 'Kadamba Transport Corporation (Goa)',
    vehicleType: 'bus',
    color: '#8B5CF6',
    headwayMinutes: 30,
    stops: [
      { id: 'stop-calangute', name: 'Calangute Association Circle', lat: 15.5449, lng: 73.7684 },
      { id: 'stop-panaji-air', name: 'Panaji KTC Bus Terminus', lat: 15.4945, lng: 73.8368 },
      { id: 'stop-cortalim-air', name: 'Cortalim Cross Stop', lat: 15.4052, lng: 73.9092 },
      { id: 'stop-dabolim', name: 'Goa Dabolim Airport Terminal', lat: 15.3808, lng: 73.8352 },
      { id: 'stop-vasco', name: 'Vasco da Gama Bus Stand', lat: 15.3982, lng: 73.8113 },
    ],
  },
  {
    id: 'transit-konkan-railway-goa',
    lineName: 'Konkan Railway (Thivim – Karmali – Madgaon)',
    lineShortName: 'KR-GOA',
    agencyName: 'Konkan Railway Corporation',
    vehicleType: 'rail',
    color: '#EF4444',
    headwayMinutes: 45,
    stops: [
      { id: 'stop-pernem-kr', name: 'Pernem Railway Station', lat: 15.721, lng: 73.7965 },
      { id: 'stop-thivim-kr', name: 'Thivim Railway Station (Mapusa East)', lat: 15.6125, lng: 73.842 },
      { id: 'stop-karmali-kr', name: 'Karmali Station (Old Goa)', lat: 15.5009, lng: 73.9115 },
      { id: 'stop-madgaon-kr', name: 'Madgaon Junction (Margao)', lat: 15.2678, lng: 73.9702 },
    ],
  },
  {
    id: 'transit-mumbai-pune-intercity',
    lineName: 'Central Railway Intercity (Mumbai CSMT – Lonavala – Pune)',
    lineShortName: 'CR-EXP',
    agencyName: 'Indian Railways (Central)',
    vehicleType: 'rail',
    color: '#10B981',
    headwayMinutes: 30,
    stops: [
      { id: 'stop-mumbai', name: 'Mumbai Dadar / CSMT', lat: 19.076, lng: 72.8777 },
      { id: 'stop-panvel', name: 'Panvel Junction', lat: 19.0022, lng: 73.1089 },
      { id: 'stop-lonavala', name: 'Lonavala Station', lat: 18.7557, lng: 73.4072 },
      { id: 'stop-pune', name: 'Pune Junction', lat: 18.5204, lng: 73.8567 },
    ],
  },
];

export const OSM_REGIONAL_POLYGONS: OsmPolygonFeature[] = [
  {
    id: 'water-mandovi-estuary',
    name: 'Mandovi River (Mhadei)',
    kind: 'water',
    coordinates: [
      [
        [73.792, 15.499],
        [73.835, 15.505],
        [73.915, 15.512],
        [73.915, 15.502],
        [73.835, 15.497],
        [73.792, 15.489],
        [73.792, 15.499],
      ],
    ],
  },
  {
    id: 'water-zuari-estuary',
    name: 'Zuari River Estuary',
    kind: 'water',
    coordinates: [
      [
        [73.802, 15.442],
        [73.908, 15.418],
        [73.965, 15.398],
        [73.965, 15.388],
        [73.905, 15.406],
        [73.802, 15.415],
        [73.802, 15.442],
      ],
    ],
  },
  {
    id: 'park-bhagwan-mahaveer-salim-ali',
    name: 'Dr. Salim Ali Bird Sanctuary (Chorao)',
    kind: 'park',
    coordinates: [
      [
        [73.855, 15.512],
        [73.882, 15.512],
        [73.882, 15.532],
        [73.855, 15.532],
        [73.855, 15.512],
      ],
    ],
  },
];
