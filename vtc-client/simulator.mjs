import { IntegrationState } from './lib/integration-state.mjs';
import { loadCatalog,buildOffer } from './lib/catalog.mjs';
const state=new IntegrationState(),catalog=await loadCatalog('ets2','standard');state.connectPlugin({game:'ets2',gameVersion:'simulator',pluginVersion:'0.1'});
const provided=buildOffer(catalog,{sourceCity:'berlin',sourceCompany:'tradeaux',destinationCity:'paris',destinationCompany:'eurogoodies',cargo:'apples',trailer:'reefer',trailerMode:'provided'});state.reserve(provided);
console.log('900 m:',state.command({distanceToSourceMeters:900}));console.log('100 m:',state.command({distanceToSourceMeters:100}));state.result({offerId:provided.id,ok:true,gameJobId:'simulation-job'});console.log('Aktiv:',state.snapshot().active);
