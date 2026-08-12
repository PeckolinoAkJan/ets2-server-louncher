import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const COMPANY_RE=/^company\s*:\s*(company\.volatile\.([^.\s]+)\.([^\s{]+))\s*\{([\s\S]*?)^\}/gm;
const OFFER_RE=/^job_offer_data\s*:\s*([^\s{]+)\s*\{([\s\S]*?)^\}/gm;

function field(block,name){const match=block.match(new RegExp(`^\\s*${name}:\\s*(.+)$`,'m'));return match?.[1]?.trim()??null;}
function clean(value){return value?.replace(/^"|"$/g,'')??null;}
function setField(block,name,value){const re=new RegExp(`^(\\s*${name}:\\s*).+$`,'m');if(!re.test(block))throw new Error(`Pflichtfeld ${name} fehlt`);return block.replace(re,`$1${value}`);}
export function parseSave(text){
  const companies=[],offers=new Map();let match;
  while((match=OFFER_RE.exec(text)))offers.set(match[1],{id:match[1],target:clean(field(match[2],'target')),expirationTime:Number(field(match[2],'expiration_time')),urgency:Number(field(match[2],'urgency')),distanceKm:Number(field(match[2],'shortest_distance_km')),cargo:field(match[2],'cargo'),companyTruck:field(match[2],'company_truck'),trailerVariant:field(match[2],'trailer_variant'),trailerDefinition:field(match[2],'trailer_definition'),unitsCount:Number(field(match[2],'units_count')),fillRatio:Number(field(match[2],'fill_ratio'))});
  while((match=COMPANY_RE.exec(text))){const links=[...match[4].matchAll(/^\s*job_offer\[\d+\]:\s*(\S+)/gm)].map(x=>x[1]);companies.push({unit:match[1],company:match[2],city:match[3],offerIds:links,offers:links.map(id=>offers.get(id)).filter(Boolean)});}
  return{companies,offers:[...offers.values()]};
}

export function createRealOfferPatch(text,{sourceUnit,destinationUnit,templateOfferId,urgency=0,distanceKm}){
  const parsed=parseSave(text),source=parsed.companies.find(x=>x.unit===sourceUnit),destination=parsed.companies.find(x=>x.unit===destinationUnit),template=parsed.offers.find(x=>x.id===templateOfferId);
  if(!source)throw new Error('Quellfirma existiert nicht im Spielstand');if(!destination)throw new Error('Zielfirma existiert nicht im Spielstand');if(!template)throw new Error('Fracht-/Trailervorlage existiert nicht im Spielstand');
  if(!source.offerIds.length)throw new Error('Die Quellfirma besitzt aktuell keinen überschreibbaren Frachtplatz');
  if(!source.offerIds.includes(templateOfferId))throw new Error('Fracht-/Trailervorlage ist für die gewählte Abholfirma nicht freigegeben');
  const targetId=source.offerIds[0];let changed=false;
  const output=text.replace(OFFER_RE,(whole,id,block)=>{if(id!==targetId)return whole;changed=true;let next=block;next=setField(next,'target',`"${destination.company}.${destination.city}"`);next=setField(next,'expiration_time',String(Math.max(template.expirationTime||0,99999999)));next=setField(next,'urgency',String(Math.max(0,Math.min(2,Number(urgency)||0))));next=setField(next,'shortest_distance_km',String(Math.max(1,Number(distanceKm)||template.distanceKm||1000)));next=setField(next,'ferry_time','0');next=setField(next,'ferry_price','0');next=setField(next,'cargo',template.cargo);next=setField(next,'company_truck',template.companyTruck);next=setField(next,'trailer_variant',template.trailerVariant);next=setField(next,'trailer_definition',template.trailerDefinition);next=setField(next,'units_count',String(template.unitsCount));next=setField(next,'fill_ratio',String(template.fillRatio||1));return`job_offer_data : ${id} {${next}\n}`;});
  if(!changed)throw new Error('Frachtplatz konnte nicht geschrieben werden');
  const proof=parseSave(output).offers.find(x=>x.id===targetId);if(proof?.target!==`${destination.company}.${destination.city}`||proof?.cargo!==template.cargo||proof?.trailerDefinition!==template.trailerDefinition)throw new Error('Nachprüfung der Fracht fehlgeschlagen');
  return{output,job:{offerId:targetId,source,destination,template,proof}};
}

export function patchSaveFile(file,input){
  if(!existsSync(file))throw new Error(`Spielstand fehlt: ${file}`);const text=readFileSync(file,'utf8');if(!text.startsWith('SiiNunit'))throw new Error('Spielstand ist noch verschlüsselt');
  const backup=`${file}.vtc-backup`;copyFileSync(file,backup);const result=createRealOfferPatch(text,input);const temp=`${file}.vtc-new`;writeFileSync(temp,result.output,'utf8');copyFileSync(temp,file);return{...result.job,file:path.resolve(file),backup:path.resolve(backup)};
}
