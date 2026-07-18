// scripts/verify-report.mjs
// Read the docx, extract document.xml + media, and verify:
//  - UTF-8 BOM not required (we use XML decl)
//  - All r:embed references match rIds in rels
//  - All PNG signatures valid
//  - Vietnamese chars preserved (check for some non-ASCII bytes)

import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(process.cwd(), "BaoCao_LuongHoatDong_HeThong.docx");
const buf = readFileSync(FILE);
const zip = await JSZip.loadAsync(buf);

const documentXml = await zip.file("word/document.xml").async("string");
const relsXml = await zip.file("word/_rels/document.xml.rels").async("string");
const contentTypes = await zip.file("[Content_Types].xml").async("string");

let ok = true;
const check = (name, cond, msg) => {
  const tag = cond ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${msg ? ": " + msg : ""}`);
  if (!cond) ok = false;
};

// 1. Vietnamese chars — check actual non-ASCII bytes are present
const hasVietnamese = /Hệ thống/.test(documentXml) || /Quy trình/.test(documentXml);
check(
  "document.xml contains Vietnamese (Hệ thống / Quy trình)",
  hasVietnamese,
  hasVietnamese ? "found" : "MISSING — file is broken",
);

// 2. r:embed references
const embedRefs = [...documentXml.matchAll(/r:embed="(rId[^"]+)"/g)].map((m) => m[1]);
console.log("\nr:embed values in document.xml:", embedRefs);

const declaredRels = [...relsXml.matchAll(/<Relationship[^>]*Id="(rId[^"]+)"/g)].map(
  (m) => m[1],
);
console.log("Declared rIds in document.xml.rels:", declaredRels);

const allEmbedsResolved = embedRefs.every((r) => declaredRels.includes(r));
check(
  "all r:embed references are declared in relationships",
  allEmbedsResolved && embedRefs.length > 0,
  `${embedRefs.length} embed(s) found, all resolved=${allEmbedsResolved}`,
);

// 3. PNG signatures
const pngEntries = Object.keys(zip.files).filter(
  (n) => /^word\/media\/.*\.png$/.test(n),
);
console.log("\nMedia PNGs:", pngEntries);
for (const n of pngEntries) {
  const data = await zip.file(n).async("uint8array");
  const sigOk = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  check(`PNG signature ${n}`, sigOk, `first 4 bytes: ${[...data.subarray(0, 4)].map((b) => b.toString(16)).join(" ")}`);
}

// 4. Content types declares png
check(
  "[Content_Types].xml has png default",
  /Extension="png"/.test(contentTypes),
);

// 5. wp:docPr — its id attribute should be a numeric pic id, NOT the rId. Word convention.
const docPrIds = [...documentXml.matchAll(/<wp:docPr[^>]*id="([^"]+)"/g)].map((m) => m[1]);
console.log("\nwp:docPr ids:", docPrIds);
const numericOnly = docPrIds.every((id) => /^\d+$/.test(id));
console.log("All wp:docPr ids numeric (should be):", numericOnly);

console.log("\n" + (ok ? "===== ALL CHECKS PASS =====" : "===== SOME CHECKS FAIL ====="));
process.exit(ok ? 0 : 1);
