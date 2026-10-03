// Rebuilds research.workflow.json from research-pipeline.js (keeps node ids and Config values).
// Run after editing the pipeline: node n8n/build-workflow.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(dir, "research.workflow.json");
const wf = JSON.parse(fs.readFileSync(file, "utf8"));
const node = wf.nodes.find((n) => n.name === "Research pipeline");
node.parameters.jsCode = fs.readFileSync(path.join(dir, "research-pipeline.js"), "utf8");
fs.writeFileSync(file, JSON.stringify(wf, null, 2) + "\n");
console.log("research.workflow.json updated");
