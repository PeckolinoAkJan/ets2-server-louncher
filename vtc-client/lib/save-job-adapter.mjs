import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {JobInjector,SiiParser} from './dispatcher-core/index.js';
const parser=new SiiParser(),injector=new JobInjector();
const clean=value=>value?.replace(/^"|"$/g,'')??null;
const scalar=(unit,key)=>unit.properties.find(property=>property.key===key&&property.index===null)?.value.raw??null;
const isOffer=unit=>unit.unitType==='company_job'||unit.unitType==='job_offer_data';

export function parseSave(text){
  const document=parser.parse(text),offers=new Map();
  for(const unit of document.units.filter(isOffer))offers.set(unit.id,{id:unit.id,target:clean(scalar(unit,'target')),expirationTime:Number(scalar(unit,'expiration_time')??scalar(unit,'time_limit')),urgency:Number(scalar(unit,'urgency')),distanceKm:Number(scalar(unit,'shortest_distance_km')),cargo:scalar(unit,'cargo'),companyTruck:scalar(unit,'company_truck'),trailerVariant:scalar(unit,'trailer_variant'),trailerDefinition:scalar(unit,'trailer_definition'),unitsCount:Number(scalar(unit,'units_count')),fillRatio:Number(scalar(unit,'fill_ratio'))});
  const companies=document.units.filter(unit=>unit.unitType==='company').map(unit=>{const match=/^company\.volatile\.([^.\s]+)\.([^\s]+)$/i.exec(unit.id);if(!match)return null;const offerIds=unit.properties.filter(property=>property.key==='job_offer'&&property.index!==null).sort((a,b)=>a.index-b.index).map(property=>property.value.raw).filter(id=>id!=='null');return{unit:unit.id,company:match[1],city:match[2],offerIds,offers:offerIds.map(id=>offers.get(id)).filter(Boolean)};}).filter(Boolean);
  return{companies,offers:[...offers.values()]};
}

export function createRealOfferPatch(text,{sourceUnit,destinationUnit,templateOfferId,urgency=0,distanceKm,durationMinutes=1440}){
  const before=parseSave(text),source=before.companies.find(company=>company.unit===sourceUnit),destination=before.companies.find(company=>company.unit===destinationUnit),template=before.offers.find(offer=>offer.id===templateOfferId);
  if(!source)throw new Error('Quellfirma existiert nicht im Spielstand');if(!destination)throw new Error('Zielfirma existiert nicht im Spielstand');if(!template)throw new Error('Fracht-/Trailervorlage existiert nicht im Spielstand');if(!source.offerIds.includes(templateOfferId))throw new Error('Fracht-/Trailervorlage ist für die gewählte Abholfirma nicht freigegeben');if(!template.cargo||!template.trailerVariant||!template.trailerDefinition)throw new Error('Fracht-/Trailervorlage ist unvollständig');
  const injected=injector.inject(parser.parse(text),{sourceCompanyUnit:sourceUnit,destinationCompanyUnit:destinationUnit,templateOfferId,cargo:template.cargo,trailerVariant:template.trailerVariant,trailerDefinition:template.trailerDefinition,durationMinutes,urgency:Math.max(0,Math.min(2,Number(urgency)||0)),distanceKm:Math.max(1,Number(distanceKm)||template.distanceKm||1000)}),output=parser.serialize(injected.document),proof=parseSave(output).offers.find(offer=>offer.id===injected.jobId);
  if(proof?.target!==`${destination.company}.${destination.city}`||proof?.cargo!==template.cargo||proof?.trailerDefinition!==template.trailerDefinition)throw new Error('Nachprüfung der Fracht fehlgeschlagen');return{output,job:{offerId:injected.jobId,source,destination,template,proof,replacedOfferId:injected.replacedJobId,timeLimit:injected.timeLimit}};
}

export function patchSaveFile(file,input){if(!existsSync(file))throw new Error(`Spielstand fehlt: ${file}`);const text=readFileSync(file,'utf8');if(!text.startsWith('SiiNunit'))throw new Error('Spielstand ist noch verschlüsselt');const backup=`${file}.vtc-backup`;copyFileSync(file,backup);const result=createRealOfferPatch(text,input),temp=`${file}.vtc-new`;writeFileSync(temp,result.output,'utf8');parser.parse(readFileSync(temp,'utf8'));copyFileSync(temp,file);return{...result.job,file:path.resolve(file),backup:path.resolve(backup)};}
