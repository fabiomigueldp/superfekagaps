import { inspectBuildOutput } from './build_output_policy';

console.log(JSON.stringify(inspectBuildOutput('dist'), null, 2));
