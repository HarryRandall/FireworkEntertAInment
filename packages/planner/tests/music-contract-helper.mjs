// Read Python-produced JSON on stdin and validate the public planner music input.
import { musicAnalysisSchema } from '../src/index.ts';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const analysis = musicAnalysisSchema.parse(JSON.parse(input));
process.stdout.write(
  JSON.stringify({ schemaVersion: analysis.schema_version, beatCount: analysis.beat_times.length }),
);
