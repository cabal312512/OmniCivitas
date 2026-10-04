// Next prefixes relative client entries with './'. On Windows a dependency
import {WebpackLicenseNotices} from '../../../scripts/bundle-license-notices.mjs';
// junction on another drive makes path.relative return an absolute path.
// Normalize that shape for any drive without prescribing a machine layout.
const normalizeEntry=value=>typeof value==='string'?value.replace(/^\.\/(?=[A-Za-z]:[\\/])/,''):Array.isArray(value)?value.map(normalizeEntry):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeEntry(v)])):value;
export default {reactStrictMode:true,poweredByHeader:false,compiler:{styledComponents:true},experimental:{cpus:1},webpack(config,{dev}){config.cache=false;const original=config.entry;config.entry=async()=>normalizeEntry(typeof original==='function'?await original():original);if(!dev)config.plugins.push(new WebpackLicenseNotices());return config;}};
