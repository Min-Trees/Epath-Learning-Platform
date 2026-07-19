import JSZip from "jszip";

export interface PptRenderResult {
  slides: { index: number; html: string }[];
  width: number;
  height: number;
}

/**
 * Convert a .pptx (Office Open XML) zip to a sequence of HTML slides.
 * Strategy: parse each slide XML in `ppt/slides/slideN.xml` to extract text
 * and shape positions, and base64-embed media (images) referenced by rels.
 *
 * .ppt (legacy binary, pre-2007) is NOT supported here — server returns 415.
 */
export async function renderPptxToHtml(buffer: ArrayBuffer | Buffer): Promise<PptRenderResult> {
  const buf =
    buffer instanceof Buffer
      ? buffer
      : Buffer.from(new Uint8Array(buffer as ArrayBuffer));
  const zip = await JSZip.loadAsync(buf);

  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });
  if (slideFiles.length === 0) {
    throw new Error("Không tìm thấy slide nào trong file PPTX");
  }

  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  const sldSize = parseSlideSize(presXml);
  const width = sldSize.width;
  const height = sldSize.height;

  const slides: { index: number; html: string }[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const slideXml = await zip.file(slidePath)?.async("string");
    if (!slideXml) continue;
    const relsPath = slidePath.replace("slides/", "slides/_rels/") + ".rels";
    const relsXml = await zip.file(relsPath)?.async("string");
    const html = await renderSlideHtml({
      slideXml,
      relsXml,
      zip,
      width,
      height,
      slideNumber: i + 1,
    });
    slides.push({ index: i + 1, html });
  }

  return { slides, width, height };
}

function parseSlideSize(presXml?: string): { width: number; height: number } {
  // Default 16:9 slide size in EMU (9144000 x 5143500).
  let width = 9144000;
  let height = 5143500;
  if (!presXml) return { width, height };
  const m = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (m) {
    width = Number(m[1]);
    height = Number(m[2]);
  }
  return { width, height };
}

async function renderSlideHtml(args: {
  slideXml: string;
  relsXml?: string;
  zip: JSZip;
  width: number;
  height: number;
  slideNumber: number;
}): Promise<string> {
  const { slideXml, relsXml, zip, width, height, slideNumber } = args;

  // Build a rel id -> target map.
  const rels = new Map<string, string>();
  if (relsXml) {
    const re = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(relsXml)) !== null) {
      rels.set(m[1], m[2]);
    }
  }

  // Walk shapes: collect text runs (with position) and pictures.
  // We extract the raw inner XML of <p:sp> and <p:pic> nodes and lightly render.
  const shapes: string[] = [];

  // Pictures: <p:pic>...<a:blip r:embed="rIdN"/>...</p:pic>
  const picRe = /<p:pic\b[\s\S]*?<\/p:pic>/g;
  let pm: RegExpExecArray | null;
  while ((pm = picRe.exec(slideXml)) !== null) {
    const node = pm[0];
    const embedMatch = node.match(/<a:blip[^>]*r:embed="([^"]+)"/);
    const offMatch = node.match(/<a:off[^>]*x="(-?\d+)"[^>]*y="(-?\d+)"/);
    const extMatch = node.match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!embedMatch) continue;
    const target = rels.get(embedMatch[1]);
    if (!target) continue;
    const mediaPath = normalizeMediaPath("ppt/slides/" + slideXml === "" ? "" : "", target);
    const buf = await zip.file(mediaPath)?.async("nodebuffer");
    if (!buf) continue;
    const mime = guessImageMime(mediaPath);
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const x = offMatch ? Number(offMatch[1]) / 9525 : 0; // EMU -> px (96dpi)
    const y = offMatch ? Number(offMatch[2]) / 9525 : 0;
    const w = extMatch ? Number(extMatch[1]) / 9525 : 200;
    const h = extMatch ? Number(extMatch[2]) / 9525 : 150;
    shapes.push(
      `<img src="${dataUrl}" style="position:absolute;left:${x.toFixed(
        1
      )}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(
        1
      )}px;max-width:none;user-select:none;-webkit-user-drag:none;" draggable="false"/>`
    );
  }

  // Shapes with text: <p:sp>...<p:spPr>...<a:off/><a:ext/><p:txBody>...</p:txBody>...</p:sp>
  const spRe = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let sm: RegExpExecArray | null;
  while ((sm = spRe.exec(slideXml)) !== null) {
    const node = sm[0];
    const offMatch = node.match(/<a:off[^>]*x="(-?\d+)"[^>]*y="(-?\d+)"/);
    const extMatch = node.match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    const x = offMatch ? Number(offMatch[1]) / 9525 : 0;
    const y = offMatch ? Number(offMatch[2]) / 9525 : 0;
    const w = extMatch ? Number(extMatch[1]) / 9525 : 200;
    const h = extMatch ? Number(extMatch[2]) / 9525 : 50;

    const txBodyMatch = node.match(/<p:txBody\b[\s\S]*?<\/p:txBody>/);
    const text = txBodyMatch ? extractTextFromTxBody(txBodyMatch[0]) : "";
    if (!text) continue;

    // Detect formatting from first run if present.
    const runMatch = txBodyMatch
      ? txBodyMatch[0].match(/<a:r\b[\s\S]*?<\/a:r>/)
      : null;
    const isBold = runMatch ? /<a:rPr[^>]*\bb="1"/.test(runMatch[0]) : false;
    const szMatch = runMatch ? runMatch[0].match(/<a:rPr[^>]*\bsz="(\d+)"/) : null;
    const fontPx = szMatch ? Math.max(10, Math.round(Number(szMatch[1]) / 100)) : 18;

    shapes.push(
      `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(
        1
      )}px;width:${w.toFixed(1)}px;height:${h.toFixed(
        1
      )}px;font-size:${fontPx}px;${isBold ? "font-weight:700;" : ""}overflow:hidden;color:#111;">${escapeHtml(
        text
      )}</div>`
    );
  }

  const scale = 1; // px math already applied
  const stageW = (width / 9525) * scale;
  const stageH = (height / 9525) * scale;

  return `<section class="ppt-slide" data-slide="${slideNumber}" style="position:relative;width:${stageW.toFixed(
    1
  )}px;height:${stageH.toFixed(1)}px;margin:0 auto 16px;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">${shapes.join(
    ""
  )}<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:white;font-size:11px;padding:2px 8px;border-radius:4px;">${slideNumber}</div></section>`;
}

function normalizeMediaPath(base: string, target: string): string {
  // Target like "../media/image1.png" relative to slide's rels file at ppt/slides/_rels/slideN.xml.rels
  // Resolved base is ppt/slides/. So "../media/foo" -> "ppt/media/foo".
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const parts = target.split("/");
  let stack = base ? base.split("/").filter(Boolean) : [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p !== ".") stack.push(p);
  }
  return stack.join("/");
}

function extractTextFromTxBody(txBody: string): string {
  const paragraphs: string[] = [];
  const pRe = /<a:p\b[\s\S]*?<\/a:p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(txBody)) !== null) {
    const runs: string[] = [];
    const rRe = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    let rm: RegExpExecArray | null;
    while ((rm = rRe.exec(m[0])) !== null) {
      runs.push(rm[1]);
    }
    paragraphs.push(runs.join(""));
  }
  return paragraphs.map((p) => (p.length ? p : "&nbsp;")).join("<br/>");
}

function guessImageMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
