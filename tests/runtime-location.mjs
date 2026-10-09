import {verificationConfig} from '../scripts/verification-config.mjs';

export const testPaths=verificationConfig();
export const testDeps=testPaths.depsRoot;
export const testReports=testPaths.reportRoot;
export const testRunner=testPaths.runnerRoot;
export const testBase=testPaths.baseUrl;
