import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAirportIndex, buildCityIndex } from '../src/core/datasets.js';

const read = (name) => JSON.parse(readFileSync(resolve(process.cwd(), 'public', 'data', name), 'utf8'));

let airports;
let cities;

export function testAirports() {
  airports ??= buildAirportIndex(read('airports.json'));
  return airports;
}

export function testCities() {
  cities ??= buildCityIndex(read('cities.json'));
  return cities;
}
