import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = path.join(ROOT, "catalog");

async function json(name) { return JSON.parse(await readFile(path.join(CATALOG, name), "utf8")); }
function unique(items) { return [...new Map(items.map(item => [item.id, item])).values()]; }

export async function loadCatalog(game, profile = "standard") {
  if (!['ets2','ats'].includes(game)) throw new Error("Unbekanntes Spiel");
  if (!['standard','promods'].includes(profile)) throw new Error("Unbekanntes Kartenprofil");
  const selected = await json(`${game}-${profile}.json`);
  if (!selected.extends) return selected;
  const base = await json(selected.extends);
  return { ...base, ...selected, cities: unique([...base.cities, ...selected.cities]), companies: unique([...base.companies, ...selected.companies]), cargo: unique([...base.cargo, ...selected.cargo]), trailers: unique([...base.trailers, ...selected.trailers]) };
}

export function buildOffer(catalog, input) {
  const city = id => catalog.cities.find(x => x.id === id);
  const company = id => catalog.companies.find(x => x.id === id);
  const sourceCity = city(input.sourceCity), destinationCity = city(input.destinationCity);
  const sourceCompany = company(input.sourceCompany), destinationCompany = company(input.destinationCompany);
  if (!sourceCity || !destinationCity || sourceCity.id === destinationCity.id) throw new Error("Ausgang und Ziel müssen gültige verschiedene Städte sein");
  if (!sourceCity.companies.includes(input.sourceCompany) || !destinationCity.companies.includes(input.destinationCompany)) throw new Error("Firma ist an der gewählten Stadt nicht vorhanden");
  const compatibleTags = sourceCompany.cargoTags.filter(tag => destinationCompany.cargoTags.includes(tag));
  const cargo = catalog.cargo.find(x => x.id === input.cargo && compatibleTags.includes(x.tag));
  if (!cargo) throw new Error("Diese Fracht ist zwischen den gewählten Firmen nicht realistisch kompatibel");
  const trailerMode = input.trailerMode === "owned" ? "owned" : "provided";
  const trailer = catalog.trailers.find(x => x.id === input.trailer && cargo.trailers.includes(x.id));
  if (!trailer) throw new Error("Trailer und Fracht sind nicht kompatibel");
  return {
    id: crypto.randomUUID(), game: catalog.game, mapProfile: catalog.profile,
    source: { city: sourceCity, company: sourceCompany }, destination: { city: destinationCity, company: destinationCompany },
    cargo, trailer: { ...trailer, mode: trailerMode }, urgency: ['normal','dringend','sehr_dringend'].includes(input.urgency) ? input.urgency : 'normal',
    navigateOnly: Boolean(input.navigateOnly), status: "reserved", createdAt: new Date().toISOString()
  };
}

export function compatibleCargo(catalog, sourceCompanyId, destinationCompanyId) {
  const a=catalog.companies.find(x=>x.id===sourceCompanyId),b=catalog.companies.find(x=>x.id===destinationCompanyId);if(!a||!b)return[];
  const tags=a.cargoTags.filter(tag=>b.cargoTags.includes(tag));return catalog.cargo.filter(c=>tags.includes(c.tag));
}
