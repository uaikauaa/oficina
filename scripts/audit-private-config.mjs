// OFFLINE ONLY. Reads local dotenv / existing container metadata, never starts a service,
// opens a DB connection or prints values, lengths, hashes, hosts or credential identities.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const names = ['DB_URL','DB_USERNAME','DB_PASSWORD','JWT_SECRET','RATE_LIMIT_SECRET','SERVICE_PROXY_SECRET',
  'INVITE_OUTBOX_KEYS','INVITE_OUTBOX_ACTIVE_VERSION','MAIL_HOST','MAIL_PORT','MAIL_USERNAME','MAIL_PASSWORD',
  'MAIL_FROM','MAIL_SMTP_AUTH','MAIL_SMTP_STARTTLS','APP_PUBLIC_URL','SUPER_ADMIN_BOOTSTRAP_EMAIL',
  'SPRING_PROFILES_ACTIVE','SECURITY_COOKIE_SECURE','CORS_ALLOWED_ORIGINS','INTERNAL_BACKEND_URL',
  'TRUSTED_PROXY_HOPS','TRUSTED_PROXIES','SECURITY_JWT_LEGACY_SESSIONLESS_ALLOWED',
  'INITIAL_ADMIN_EMAIL','INITIAL_ADMIN_PASSWORD','NEON_PROJECT_ID','NEON_API_KEY'];
function assess(env) {
  const present = key => typeof env[key] === 'string' && env[key].trim() !== '';
  let db, publicUrl, origins;
  try { db = new URL(env.DB_URL?.replace(/^jdbc:/,'')); } catch {}
  try { publicUrl = new URL(env.APP_PUBLIC_URL); } catch {}
  try { origins = env.CORS_ALLOWED_ORIGINS?.split(',').map(x=>new URL(x.trim())); } catch {}
  let validKeys=false;
  try {
    const keys = new Map();
    for(const entry of (env.INVITE_OUTBOX_KEYS || '').split(',')) {
      const [version,key] = entry.trim().split(':');
      if (!/^[1-9]\d*$/.test(version) || !/^[A-Za-z0-9+/]{43}=$/.test(key || '') ||
          Buffer.from(key,'base64').length!==32 || keys.has(version)) throw Error();
      keys.set(version,key);
    }
    validKeys=keys.has(env.INVITE_OUTBOX_ACTIVE_VERSION || '1');
  } catch {}
  return {presence:Object.fromEntries(names.map(n=>[n,present(n)])),checks:{
    databaseUrlParsable:!!db,databaseLoopback:!!db && ['localhost','127.0.0.1','::1'].includes(db.hostname),
    databaseNeonHostname:!!db && db.hostname.endsWith('.neon.tech'),
    databaseVerifyFull:db?.searchParams.get('sslmode')==='verify-full',
    databaseExplicitCA:!!db?.searchParams.get('sslrootcert'),
    databaseCredentialsEmbedded:!!db && !!(db.username || db.password || db.searchParams.get('password')),
    jwtMinimumLength:present('JWT_SECRET') && env.JWT_SECRET.trim().length>=32,
    rateIndependent:present('RATE_LIMIT_SECRET') && env.RATE_LIMIT_SECRET.length>=32 && env.RATE_LIMIT_SECRET!==env.JWT_SECRET,
    proxyMinimumLength:present('SERVICE_PROXY_SECRET') && env.SERVICE_PROXY_SECRET.length>=32,
    configuredSecretsDistinct:[env.JWT_SECRET,env.RATE_LIMIT_SECRET,env.SERVICE_PROXY_SECRET].filter(Boolean).length===
      new Set([env.JWT_SECRET,env.RATE_LIMIT_SECRET,env.SERVICE_PROXY_SECRET].filter(Boolean)).size,
    outboxKeysAndActiveVersionValid:validKeys,
    smtpCredentialsComplete:['MAIL_HOST','MAIL_USERNAME','MAIL_PASSWORD','MAIL_FROM'].every(present),
    smtpAuthExplicit:env.MAIL_SMTP_AUTH==='true',smtpStarttlsExplicit:env.MAIL_SMTP_STARTTLS==='true',
    publicHttps:publicUrl?.protocol==='https:',
    corsExactHttps:!!origins?.length && origins.every(u=>u.protocol==='https:' && !u.hostname.includes('*') &&
      !['localhost','127.0.0.1'].includes(u.hostname) && u.pathname==='/' && !u.search && !u.hash),
    profileProduction:env.SPRING_PROFILES_ACTIVE?.split(',').some(p=>['prod','production'].includes(p.trim())) || false,
    cookieSecureExplicit:env.SECURITY_COOKIE_SECURE==='true',
    sessionlessOverrideEnabled:env.SECURITY_JWT_LEGACY_SESSIONLESS_ALLOWED==='true',
    publicSecretVariableNames:Object.keys(env).filter(k=>/^NEXT_PUBLIC_.*(SECRET|PASSWORD|DB_URL|OUTBOX_KEYS)/.test(k)),
  }};
}
const reports=[];
for(let i=2;i<process.argv.length;i+=2) {
  const kind=process.argv[i], target=process.argv[i+1]; let env={};
  if(kind==='--dotenv') {
    for(const line of fs.readFileSync(target,'utf8').split(/\r?\n/)) {
      const s=line.trim(); if(!s || s.startsWith('#'))continue;
      const eq=s.indexOf('='); if(eq<1)continue;
      let value=s.slice(eq+1).trim();
      if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
      env[s.slice(0,eq).trim()]=value;
    }
    reports.push({source:'local-dotenv',...assess(env)});
  } else if(kind==='--container') {
    const data=JSON.parse(execFileSync('docker',['inspect',target],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}))[0];
    for(const pair of data.Config.Env || []) {const eq=pair.indexOf('='); env[pair.slice(0,eq)]=pair.slice(eq+1);}
    reports.push({source:target,additionalOverrideSourcesPresent:
      ['SPRING_APPLICATION_JSON','JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','SPRING_CONFIG_LOCATION','SPRING_CONFIG_ADDITIONAL_LOCATION','SPRING_CONFIG_IMPORT']
        .some(k=>!!env[k]) || [...(data.Config.Cmd||[]),...(data.Config.Entrypoint||[])].some(x=>/^(-D|--spring\.)/.test(x)),...assess(env)});
  } else throw Error('Only --dotenv and --container local inspection are supported');
}
reports.push({source:'current-process',...assess(process.env)});
console.log(JSON.stringify({scope:'Offline presence and policy checks; no secrets or connections; runtime overrides outside inspected sources remain unverified',reports},null,2));
