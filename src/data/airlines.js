/**
 * Airlines used for flight-number detection, sender matching and card colours.
 * [IATA code, name, accent colour, email domains, extra names]
 */
const RAW = [
  // Korea
  ['KE', 'Korean Air', '#00a5e5', ['koreanair.com']],
  ['OZ', 'Asiana Airlines', '#d6202f', ['flyasiana.com']],
  ['7C', 'Jeju Air', '#ff5000', ['jejuair.net']],
  ['LJ', 'Jin Air', '#8dc63f', ['jinair.com']],
  ['TW', "T'way Air", '#e5004f', ['twayair.com'], ['tway air', 'tway']],
  ['BX', 'Air Busan', '#2f6fde', ['airbusan.com']],
  ['RS', 'Air Seoul', '#00b2a9', ['flyairseoul.com']],
  ['ZE', 'Eastar Jet', '#e60012', ['eastarjet.com']],
  ['RF', 'Aero K', '#2f80ed', ['aerok.com']],
  ['YP', 'Air Premia', '#5a6fd6', ['airpremia.com']],
  // Japan
  ['JL', 'Japan Airlines', '#e60012', ['jal.co.jp', 'jal.com'], ['JAL']],
  ['NH', 'ANA', '#2f63c9', ['ana.co.jp'], ['All Nippon Airways']],
  ['MM', 'Peach Aviation', '#d6006f', ['flypeach.com'], ['Peach']],
  ['GK', 'Jetstar Japan', '#ff5f00', ['jetstar.com']],
  ['BC', 'Skymark Airlines', '#2b6cc4', ['skymark.co.jp'], ['Skymark']],
  ['ZG', 'ZIPAIR', '#00a29a', ['zipair.net']],
  ['IJ', 'Spring Japan', '#3cb371', ['ch.com']],
  ['HD', 'Air Do', '#00a0e9', ['airdo.jp']],
  ['6J', 'Solaseed Air', '#7cc242', ['solaseedair.jp']],
  ['7G', 'StarFlyer', '#9ca3af', ['starflyer.jp']],
  // Greater China
  ['CX', 'Cathay Pacific', '#00857d', ['cathaypacific.com'], ['Cathay']],
  ['UO', 'HK Express', '#8b3fb5', ['hkexpress.com']],
  ['HX', 'Hong Kong Airlines', '#c8102e', ['hongkongairlines.com']],
  ['NX', 'Air Macau', '#d50032', ['airmacau.com.mo']],
  ['CI', 'China Airlines', '#e2007a', ['china-airlines.com']],
  ['BR', 'EVA Air', '#00a050', ['evaair.com']],
  ['JX', 'STARLUX Airlines', '#c49a5a', ['starlux-airlines.com'], ['STARLUX']],
  ['IT', 'Tigerair Taiwan', '#f37021', ['tigerairtw.com']],
  ['CA', 'Air China', '#e30613', ['airchina.com', 'airchina.com.cn']],
  ['MU', 'China Eastern Airlines', '#2a5caa', ['ceair.com'], ['China Eastern']],
  ['CZ', 'China Southern Airlines', '#1f7ae0', ['csair.com'], ['China Southern']],
  ['HU', 'Hainan Airlines', '#e2231a', ['hainanairlines.com']],
  ['ZH', 'Shenzhen Airlines', '#e60012', ['shenzhenair.com']],
  ['3U', 'Sichuan Airlines', '#cc0000', ['sichuanair.com']],
  ['MF', 'Xiamen Airlines', '#1f78c8', ['xiamenair.com']],
  ['FM', 'Shanghai Airlines', '#c8102e', ['ceair.com']],
  ['9C', 'Spring Airlines', '#00a651', ['ch.com']],
  ['HO', 'Juneyao Air', '#d4202c', ['juneyaoair.com'], ['Juneyao Airlines']],
  // South-East Asia
  ['SQ', 'Singapore Airlines', '#f0a500', ['singaporeair.com']],
  ['TR', 'Scoot', '#ffd200', ['flyscoot.com']],
  ['MH', 'Malaysia Airlines', '#e31837', ['malaysiaairlines.com']],
  ['AK', 'AirAsia', '#ff2d2d', ['airasia.com']],
  ['D7', 'AirAsia X', '#ff2d2d', ['airasia.com']],
  ['FD', 'Thai AirAsia', '#ff2d2d', ['airasia.com']],
  ['Z2', 'AirAsia Philippines', '#ff2d2d', ['airasia.com']],
  ['QZ', 'Indonesia AirAsia', '#ff2d2d', ['airasia.com']],
  ['OD', 'Batik Air Malaysia', '#c8102e', ['batikair.com.my', 'malindoair.com'], ['Malindo Air']],
  ['TG', 'Thai Airways', '#7b3fb0', ['thaiairways.com'], ['Thai Airways International']],
  ['PG', 'Bangkok Airways', '#1a8ad4', ['bangkokair.com']],
  ['SL', 'Thai Lion Air', '#e2231a', ['lionairthai.com']],
  ['DD', 'Nok Air', '#ffd400', ['nokair.com']],
  ['VZ', 'Thai Vietjet Air', '#e30613', ['vietjetair.com']],
  ['VN', 'Vietnam Airlines', '#00879a', ['vietnamairlines.com']],
  ['VJ', 'VietJet Air', '#e30613', ['vietjetair.com'], ['Vietjet']],
  ['QH', 'Bamboo Airways', '#00a651', ['bambooairways.com']],
  ['VU', 'Vietravel Airlines', '#2a8fd1', ['vietravelairlines.com']],
  ['K6', 'Cambodia Angkor Air', '#d2232a', ['cambodiaangkorair.com']],
  ['KR', 'Cambodia Airways', '#c09853', ['cambodia-airways.com']],
  ['QV', 'Lao Airlines', '#1f7ac2', ['laoairlines.com']],
  ['8M', 'Myanmar Airways International', '#2f6cc1', ['maiair.com']],
  ['PR', 'Philippine Airlines', '#2f5fd0', ['philippineairlines.com']],
  ['5J', 'Cebu Pacific', '#ffb81c', ['cebupacificair.com']],
  ['GA', 'Garuda Indonesia', '#1d8fb5', ['garuda-indonesia.com']],
  ['JT', 'Lion Air', '#e2231a', ['lionair.co.id']],
  ['ID', 'Batik Air', '#b0122b', ['batikair.com']],
  ['QG', 'Citilink', '#7ab800', ['citilink.co.id']],
  ['BI', 'Royal Brunei Airlines', '#c8a24b', ['flyroyalbrunei.com']],
  // South & Central Asia
  ['AI', 'Air India', '#d7263d', ['airindia.com', 'airindia.in']],
  ['6E', 'IndiGo', '#3d5af1', ['goindigo.in']],
  ['UK', 'Vistara', '#7b3fa0', ['airvistara.com']],
  ['SG', 'SpiceJet', '#e5202e', ['spicejet.com']],
  ['IX', 'Air India Express', '#e85a3c', ['airindiaexpress.com']],
  ['UL', 'SriLankan Airlines', '#2f6fd0', ['srilankan.com']],
  ['PK', 'Pakistan International Airlines', '#1e9e5a', ['piac.com.pk'], ['PIA']],
  ['KC', 'Air Astana', '#3fa9f5', ['airastana.com']],
  ['HY', 'Uzbekistan Airways', '#1f9ad6', ['uzairways.com']],
  ['OM', 'MIAT Mongolian Airlines', '#2f6fd0', ['miat.com']],
  // Middle East & Africa
  ['EK', 'Emirates', '#d71921', ['emirates.com']],
  ['QR', 'Qatar Airways', '#8c1d4f', ['qatarairways.com']],
  ['EY', 'Etihad Airways', '#bd8b13', ['etihad.com'], ['Etihad']],
  ['FZ', 'flydubai', '#f26722', ['flydubai.com']],
  ['G9', 'Air Arabia', '#e2231a', ['airarabia.com']],
  ['SV', 'Saudia', '#1f9e5a', ['saudia.com']],
  ['XY', 'flynas', '#73b72b', ['flynas.com']],
  ['GF', 'Gulf Air', '#b39c6a', ['gulfair.com']],
  ['WY', 'Oman Air', '#a4813f', ['omanair.com']],
  ['KU', 'Kuwait Airways', '#1f6fc4', ['kuwaitairways.com']],
  ['RJ', 'Royal Jordanian', '#b49b6c', ['rj.com']],
  ['ME', 'Middle East Airlines', '#1e9e5a', ['mea.com.lb']],
  ['TK', 'Turkish Airlines', '#e30a17', ['turkishairlines.com', 'thy.com']],
  ['PC', 'Pegasus Airlines', '#f9b200', ['flypgs.com'], ['Pegasus']],
  ['LY', 'El Al', '#2f5fd0', ['elal.com']],
  ['MS', 'EgyptAir', '#2f6fd0', ['egyptair.com']],
  ['ET', 'Ethiopian Airlines', '#1e9e5a', ['ethiopianairlines.com']],
  ['KQ', 'Kenya Airways', '#e2231a', ['kenya-airways.com']],
  ['SA', 'South African Airways', '#2f6fd0', ['flysaa.com']],
  ['AT', 'Royal Air Maroc', '#c8102e', ['royalairmaroc.com']],
  ['WB', 'RwandAir', '#1fa3dc', ['rwandair.com']],
  // Europe
  ['LH', 'Lufthansa', '#f9ba00', ['lufthansa.com']],
  ['LX', 'SWISS', '#e2001a', ['swiss.com'], ['Swiss International Air Lines']],
  ['OS', 'Austrian Airlines', '#e2001a', ['austrian.com']],
  ['SN', 'Brussels Airlines', '#d0103a', ['brusselsairlines.com']],
  ['EW', 'Eurowings', '#a3195b', ['eurowings.com']],
  ['DE', 'Condor', '#f5b700', ['condor.com']],
  ['AF', 'Air France', '#3a66c9', ['airfrance.com', 'airfrance.fr']],
  ['KL', 'KLM', '#00a1de', ['klm.com'], ['KLM Royal Dutch Airlines']],
  ['HV', 'Transavia', '#00c853', ['transavia.com']],
  ['BA', 'British Airways', '#2f74d0', ['britishairways.com', 'ba.com']],
  ['VS', 'Virgin Atlantic', '#da0530', ['virginatlantic.com', 'fly.virgin.com']],
  ['LS', 'Jet2', '#e8112d', ['jet2.com']],
  ['BY', 'TUI Airways', '#00a5df', ['tui.co.uk']],
  ['IB', 'Iberia', '#d7192d', ['iberia.com']],
  ['VY', 'Vueling', '#ffcc00', ['vueling.com']],
  ['UX', 'Air Europa', '#2f62c9', ['aireuropa.com']],
  ['AZ', 'ITA Airways', '#2a7fd4', ['ita-airways.com', 'alitalia.com'], ['Alitalia']],
  ['TP', 'TAP Air Portugal', '#1fa64a', ['flytap.com'], ['TAP Portugal']],
  ['EI', 'Aer Lingus', '#00a39b', ['aerlingus.com']],
  ['FR', 'Ryanair', '#f1c933', ['ryanair.com']],
  ['U2', 'easyJet', '#ff6600', ['easyjet.com']],
  ['W6', 'Wizz Air', '#c6007e', ['wizzair.com']],
  ['DY', 'Norwegian', '#d81939', ['norwegian.com'], ['Norwegian Air Shuttle']],
  ['SK', 'SAS', '#3b5bdb', ['flysas.com'], ['Scandinavian Airlines']],
  ['AY', 'Finnair', '#2f5bd6', ['finnair.com']],
  ['FI', 'Icelandair', '#2d6fd1', ['icelandair.com']],
  ['BT', 'airBaltic', '#b5d334', ['airbaltic.com']],
  ['LO', 'LOT Polish Airlines', '#2a5db0', ['lot.com'], ['LOT']],
  ['A3', 'Aegean Airlines', '#3b7dd8', ['aegeanair.com']],
  ['SU', 'Aeroflot', '#2a5caa', ['aeroflot.ru', 'aeroflot.com']],
  // Americas
  ['AA', 'American Airlines', '#0078d2', ['aa.com']],
  ['DL', 'Delta Air Lines', '#e01933', ['delta.com'], ['Delta']],
  ['UA', 'United Airlines', '#1f6fd1', ['united.com'], ['United']],
  ['WN', 'Southwest Airlines', '#ffbf27', ['southwest.com', 'luv.southwest.com'], ['Southwest']],
  ['B6', 'JetBlue', '#3b6ad9', ['jetblue.com']],
  ['AS', 'Alaska Airlines', '#2a8bc7', ['alaskaair.com']],
  ['NK', 'Spirit Airlines', '#ffec00', ['spirit.com', 'fly.spirit-airlines.com']],
  ['F9', 'Frontier Airlines', '#248168', ['flyfrontier.com']],
  ['HA', 'Hawaiian Airlines', '#a6198e', ['hawaiianairlines.com']],
  ['AC', 'Air Canada', '#f01428', ['aircanada.com', 'aircanada.ca']],
  ['WS', 'WestJet', '#0b9ea9', ['westjet.com']],
  ['AM', 'Aeroméxico', '#2a5ca8', ['aeromexico.com'], ['Aeromexico']],
  ['Y4', 'Volaris', '#a0228f', ['volaris.com']],
  ['CM', 'Copa Airlines', '#2e5bd1', ['copaair.com']],
  ['AV', 'Avianca', '#da291c', ['avianca.com']],
  ['LA', 'LATAM Airlines', '#ed1650', ['latam.com', 'latamairlines.com'], ['LATAM']],
  ['JJ', 'LATAM Brasil', '#ed1650', ['latam.com']],
  ['G3', 'GOL', '#ff7020', ['voegol.com.br'], ['GOL Linhas Aéreas']],
  ['AD', 'Azul', '#1a5ddb', ['voeazul.com.br'], ['Azul Brazilian Airlines']],
  ['AR', 'Aerolíneas Argentinas', '#0f7ac1', ['aerolineas.com.ar'], ['Aerolineas Argentinas']],
  // Oceania
  ['QF', 'Qantas', '#e0001b', ['qantas.com', 'qantas.com.au']],
  ['JQ', 'Jetstar', '#ff5f00', ['jetstar.com']],
  ['VA', 'Virgin Australia', '#cc0033', ['virginaustralia.com']],
  ['NZ', 'Air New Zealand', '#14b8a6', ['airnewzealand.com', 'airnewzealand.co.nz']],
  ['FJ', 'Fiji Airways', '#1f8fc8', ['fijiairways.com']],
];

export const AIRLINES = RAW.map(([code, name, color, domains = [], aliases = []]) => ({ code, name, color, domains, aliases }));

const BY_CODE = new Map(AIRLINES.map((a) => [a.code, a]));

export function airlineByCode(code) {
  return code ? BY_CODE.get(String(code).toUpperCase()) || null : null;
}

export function airlineByDomain(email) {
  const domain = String(email || '').toLowerCase().split('@').pop().replace(/>.*$/, '');
  if (!domain) return null;
  return AIRLINES.find((a) => a.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) || null;
}

export function searchAirlines(query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return AIRLINES.slice(0, limit);
  return AIRLINES.map((a) => {
    let score = 0;
    if (a.code.toLowerCase() === q) score = 100;
    else if (a.name.toLowerCase().startsWith(q)) score = 60;
    else if (a.aliases.some((x) => x.toLowerCase().startsWith(q))) score = 50;
    else if (a.name.toLowerCase().includes(q)) score = 30;
    return { a, score };
  })
    .filter((x) => x.score)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}

/** Deterministic accent colour for airlines that are not in the list. */
export function airlineColor(airline) {
  if (airline?.color) return airline.color;
  const known = airlineByCode(airline?.code);
  if (known) return known.color;
  const palette = ['#38bdf8', '#a78bfa', '#f472b6', '#2dd4bf', '#fbbf24', '#fb7185', '#818cf8'];
  const key = airline?.code || airline?.name || '';
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Travel agencies / OTAs whose confirmations we also look for in Gmail. */
export const TRAVEL_AGENCY_DOMAINS = [
  'expedia.com', 'booking.com', 'trip.com', 'ctrip.com', 'agoda.com', 'kayak.com', 'skyscanner.net', 'priceline.com',
  'orbitz.com', 'travelocity.com', 'cheapoair.com', 'kiwi.com', 'edreams.com', 'opodo.com', 'gotogate.com', 'mytrip.com',
  'traveloka.com', 'tiket.com', 'makemytrip.com', 'cleartrip.com', 'interpark.com', 'hanatour.com', 'modetour.com',
  'myrealtrip.com', 'tidesquare.com', 'yanolja.com', 'his-j.com', 'skygate.co.jp', 'tripit.com', 'hopper.com',
  'flighthub.com', 'justfly.com', 'wego.com', 'airasia.com', 'lastminute.com',
];
