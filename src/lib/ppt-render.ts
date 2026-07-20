import { parse as parsePptx, Slide as PptSlide, Element as PptElement } from "pptxtojson";

export interface PptRenderResult {
  slides: { index: number; html: string }[];
  width: number;
  height: number;
}

/**
 * Convert a .pptx (Office Open XML) buffer to a sequence of HTML slides.
 * Uses pptxtojson to do the heavy lifting (shape positions, text formatting,
 * images as base64, tables, etc.), then we map its JSON to our HTML format.
 *
 * .ppt (legacy binary, pre-2007) is NOT supported here — server returns 415.
 */
export async function renderPptxToHtml(
  buffer: ArrayBuffer | Buffer
): Promise<PptRenderResult> {
  const ab =
    buffer instanceof Buffer
      ? buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        )
      : buffer;
  const parsed = await parsePptx(ab as ArrayBuffer, {
    imageMode: "base64",
    videoMode: "none",
    audioMode: "none",
  });

  // pptxtojson reports slide size in points (1pt = 1.333px at 96dpi).
  const widthPx = Math.round((parsed.size.width * 96) / 72);
  const heightPx = Math.round((parsed.size.height * 96) / 72);

  const slides = parsed.slides.map((s, i) => ({
    index: i + 1,
    html: renderSlideHtml(s, i + 1, parsed.size.width, parsed.size.height),
  }));

  return { slides, width: widthPx, height: heightPx };
}

function renderSlideHtml(
  slide: PptSlide,
  slideNumber: number,
  stageW: number,
  stageH: number
): string {
  const elements = slide.elements ?? [];
  const shapes = elements
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(renderElement)
    .filter(Boolean)
    .join("");

  const background = renderFill(slide.fill);

  return (
    `<section class="ppt-slide" data-slide="${slideNumber}" style="position:relative;width:${px(stageW)};height:${px(stageH)};margin:0 auto 16px;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;${background}">` +
    `<style>.ppt-slide p{margin:0;}</style>` +
    shapes +
    `<div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:white;font-size:11px;padding:2px 8px;border-radius:4px;">${slideNumber}</div>` +
    `</section>`
  );
}

function renderElement(el: PptElement): string {
  switch (el.type) {
    case "text":
      return renderText(el);
    case "image":
      return renderImage(el);
    case "shape":
      return renderShape(el);
    case "table":
      return renderTable(el);
    case "group":
      return renderGroup(el);
    default:
      return "";
  }
}

function posStyle(el: { left: number; top: number; width: number; height: number; rotate?: number; isFlipH?: boolean; isFlipV?: boolean }): string {
  const transform: string[] = [];
  if (el.rotate) transform.push(`rotate(${el.rotate}deg)`);
  if (el.isFlipH || el.isFlipV) {
    const sx = el.isFlipH ? -1 : 1;
    const sy = el.isFlipV ? -1 : 1;
    transform.push(`scale(${sx},${sy})`);
  }
  const t = transform.length ? `transform:${transform.join(" ")};transform-origin:center;` : "";
  return `position:absolute;left:${px(el.left)};top:${px(el.top)};width:${px(el.width)};height:${px(el.height)};${t}`;
}

function renderText(t: Extract<PptElement, { type: "text" }>): string {
  const fill = renderFill(t.fill);
  const border = renderBorder(t);
  // pptxtojson returns `content` as HTML string already (with inline styles).
  // Trust it as-is — same approach the library docs use.
  return `<div style="${posStyle(t)}${fill}${border}overflow:hidden;line-height:1.2;">${t.content || ""}</div>`;
}

function renderImage(img: Extract<PptElement, { type: "image" }>): string {
  const src = img.base64 ? `data:${img.geom || "image/png"};base64,${img.base64}` : "";
  if (!src) return "";
  const border = renderBorder(img);
  return `<img src="${src}" style="${posStyle(img)}${border}max-width:none;user-select:none;-webkit-user-drag:none;object-fit:contain;" draggable="false"/>`;
}

function renderShape(s: Extract<PptElement, { type: "shape" }>): string {
  const fill = renderFill(s.fill);
  const border = renderBorder(s);
  const color = (s.fill && s.fill.type === "color") ? s.fill.value : "#fff";
  // For shapes with text, render shape as background; text is already in `content`.
  return `<div style="${posStyle(s)}${fill}${border}color:${color};overflow:hidden;line-height:1.2;">${s.content || ""}</div>`;
}

function renderTable(tbl: Extract<PptElement, { type: "table" }>): string {
  const rows = (tbl.data || [])
    .map((row, ri) => {
      const tds = row
        .map((cell, ci) => {
          const bg =
            cell.fillColor && cell.fillColor !== "none"
              ? `background:${cell.fillColor};`
              : "";
          const fg = cell.fontColor ? `color:${cell.fontColor};` : "";
          const bold = cell.fontBold ? "font-weight:700;" : "";
          const cs = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "";
          const rs = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : "";
          const align = cell.vAlign ? `vertical-align:${cell.vAlign};` : "";
          return `<td${cs}${rs} style="${bg}${fg}${bold}${align}padding:4px 6px;border:1px solid #ddd;">${cell.text || ""}</td>`;
        })
        .join("");
      return `<tr${ri === 0 ? "" : ""}>${tds}</tr>`;
    })
    .join("");
  return `<table style="${posStyle(tbl)}border-collapse:collapse;font-size:12px;">${rows}</table>`;
}

function renderGroup(g: Extract<PptElement, { type: "group" }>): string {
  const inner = (g.elements || [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(renderElement)
    .filter(Boolean)
    .join("");
  return `<div style="${posStyle(g)}">${inner}</div>`;
}

function renderFill(fill?: { type: string; value: any }): string {
  if (!fill) return "";
  if (fill.type === "color" && fill.value) {
    return `background:${fill.value};`;
  }
  if (fill.type === "image" && fill.value?.base64) {
    return `background-image:url(data:${fill.value.blob || "image/png"};base64,${fill.value.base64});background-size:cover;`;
  }
  return "";
}

function renderBorder(el: {
  borderColor?: string;
  borderWidth?: number;
  borderType?: string;
}): string {
  if (!el.borderColor || !el.borderWidth) return "";
  const style =
    el.borderType === "dashed"
      ? "dashed"
      : el.borderType === "dotted"
        ? "dotted"
        : "solid";
  return `border:${el.borderWidth}px ${style} ${el.borderColor};`;
}

function px(pt: number): string {
  return `${Math.round((pt * 96) / 72)}px`;
}