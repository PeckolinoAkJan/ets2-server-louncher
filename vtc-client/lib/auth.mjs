import crypto from "node:crypto";

export function createSteamLoginUrl(panelUrl, returnUrl, state) {
  const endpoint = new URL('https://steamcommunity.com/openid/login');
  const realm = new URL(panelUrl).origin + '/';
  const params={"openid.ns":"http://specs.openid.net/auth/2.0","openid.mode":"checkid_setup","openid.return_to":`${returnUrl}?state=${encodeURIComponent(state)}`,"openid.realm":realm,"openid.identity":"http://specs.openid.net/auth/2.0/identifier_select","openid.claimed_id":"http://specs.openid.net/auth/2.0/identifier_select"};
  for(const [key,value] of Object.entries(params))endpoint.searchParams.set(key,value);return endpoint.toString();
}
export function newAuthState(){return crypto.randomBytes(24).toString('base64url');}
export function validateLinkedAccount(session){if(!session?.steamId)throw new Error('Steam-Anmeldung erforderlich');if(!session?.vtcAccountId)throw new Error('Steam-Konto muss mit einem VTC-Konto verknüpft sein');return true;}
