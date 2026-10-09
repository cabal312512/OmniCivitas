import path from 'node:path';
import {projectRoot,resolveRuntimePaths} from './runtime-paths.mjs';

try { process.loadEnvFile(path.join(projectRoot,'.env')); }
catch (error) { if (error.code!=='ENOENT') throw error; }

export function verificationConfig(environment=process.env,repository=projectRoot) {
  const paths=resolveRuntimePaths({repository,environment});
  const port=(name,fallback)=>{
    const value=environment[name]||String(fallback);
    if (!/^\d+$/.test(value)||Number(value)<1||Number(value)>65535) throw Error(`Invalid ${name} port.`);
    return value;
  };
  return {
    ...paths,
    baseUrl:environment.OCV_BASE_URL||`http://127.0.0.1:${port('OCV_WEB_PORT',paths.config.ports?.web??8080)}`,
    grafanaUrl:environment.OCV_GRAFANA_BASE_URL||`http://127.0.0.1:${port('OCV_GRAFANA_PORT',paths.config.ports?.grafana??3001)}`,
  };
}
