// scripts/build-report.mjs
// Build a .docx report with 3 mermaid PNG diagrams embedded inline.
// Pure JSZip — no external docx library.

import JSZip from "jszip";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "BaoCao_LuongHoatDong_HeThong.docx");

// ---------- helpers -----------------------------------------------------------

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const p = (text) =>
  `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;

const heading = (text, level) => {
  const lvl = Math.max(1, Math.min(level, 9));
  return `<w:p><w:pPr><w:pStyle w:val="Heading${lvl}"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(
    text,
  )}</w:t></w:r></w:p>`;
};

const bullet = (text) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(
    text,
  )}</w:t></w:r></w:p>`;

const para_after_image = (text) =>
  `<w:p><w:pPr><w:spacing w:before="120" w:after="200"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">${xmlEscape(
    text,
  )}</w:t></w:r></w:p>`;

// Embed PNG image — drawn by relationship id (rIdX).
// Word requires: wp:docPr id MUST be a numeric id; a:blip r:embed MUST be the rId.
const image = (rId, cx_emu, cy_emu) => {
  // use a stable numeric docPrId derived from rId — fine for our case
  const docPrId = Number(String(rId).replace(/[^0-9]/g, "")) || 1;
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="80"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx_emu}" cy="${cy_emu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="Picture ${docPrId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="Picture ${docPrId}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx_emu}" cy="${cy_emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
};

// ---------- image dimensions --------------------------------------------------
// A4 printable width ≈ 6.5 inch = 5,943,600 EMU. We pick max ~6.0 inch usable.
// 1 inch = 914400 EMU. 6.0 inch = 5486400 EMU.
// Maintain aspect ratio by computing from real PNG dimensions.

const PNG_SIZES = {
  "diagram-1-create.png": { w: 1200, h: 1400 },
  "diagram-2-view.png":   { w: 1200, h: 1400 },
  "diagram-3-manage.png": { w: 1400, h: 1500 },
};

const MAX_WIDTH_EMU = 5_400_000; // ~5.91 inch

const imageEmu = (filename) => {
  const { w, h } = PNG_SIZES[filename];
  const cx = Math.min(MAX_WIDTH_EMU, w * 9525); // 1 px = 9525 EMU at 96 DPI
  const cy = Math.round((cx / w) * h);
  return { cx, cy };
};

// ---------- content ----------------------------------------------------------

const TITLE = "BÁO CÁO LUỒNG HOẠT ĐỘNG HỆ THỐNG ePath";

const INTRO = `Hệ thống ePath là nền tảng đào tạo nội bộ giúp doanh nghiệp số hoá
quá trình đào tạo nhân viên. Báo cáo này mô tả ba quy trình nghiệp vụ chính:
(1) Quy trình tạo và giao tài liệu, (2) Quy trình học viên xem tài liệu và
hoàn thành khóa học, (3) Quy trình quản lý hệ thống dành cho quản trị viên
và lãnh đạo. Mỗi quy trình được minh hoạ bằng sơ đồ trực quan.`;

// Section 1 — overview
const SECTION_1 = {
  title: "1. TỔNG QUAN HỆ THỐNG",
  body: [
    p(
      "Hệ thống phục vụ ba nhóm người dùng chính:",
    ),
    bullet("Quản trị viên (Admin): tạo và quản lý nội dung đào tạo, quản lý tài khoản người dùng."),
    bullet("Học viên (User): truy cập chương trình được giao, xem video, đọc tài liệu, làm bài kiểm tra."),
    bullet("Quản lý / Lãnh đạo (Leader): theo dõi tiến độ học tập của nhân viên, xem báo cáo tổng hợp."),
    p(
      "Mọi tài liệu sau khi được Admin đăng tải sẽ được lưu trữ tập trung và phân phối theo phân quyền. Hệ thống tự động ghi nhận quá trình học của từng học viên để phục vụ báo cáo.",
    ),
  ],
};

// Section 2 — create content
const SECTION_2 = {
  title: "2. QUY TRÌNH TẠO VÀ GIAO TÀI LIỆU",
  body: [
    p(
      "Quy trình do Admin thực hiện, bắt đầu từ việc tạo chương trình đào tạo, đến tải tài liệu lên hệ thống, và kết thúc bằng việc giao chương trình cho học viên cụ thể.",
    ),
    image("rIdImg1", imageEmu("diagram-1-create.png").cx, imageEmu("diagram-1-create.png").cy),
    para_after_image("Sơ đồ 1: Quy trình tạo và giao tài liệu."),
    p("Các bước chính:"),
    bullet("Bước 1 — Đăng nhập: Admin truy cập hệ thống bằng tài khoản được cấp."),
    bullet("Bước 2 — Tạo chương trình đào tạo: đặt tên, mô tả, thời hạn áp dụng."),
    bullet("Bước 3 — Tạo khóa học trong chương trình: mỗi chương trình có thể gồm nhiều khóa học."),
    bullet("Bước 4 — Thêm bài học cho mỗi khóa học: video giảng, tài liệu PDF, hoặc bài kiểm tra."),
    bullet("Bước 5 — Tải tệp lên hệ thống: video và PDF được đăng tải và lưu trữ tập trung."),
    bullet("Bước 6 — Soạn bài kiểm tra (nếu có): tạo câu hỏi, đáp án và điểm đạt."),
    bullet("Bước 7 — Giao chương trình cho học viên: chọn người hoặc nhóm người được phép truy cập."),
    p(
      "Sau khi hoàn tất, học viên được giao sẽ nhìn thấy chương trình trong trang cá nhân của họ.",
    ),
  ],
};

// Section 3 — view content
const SECTION_3 = {
  title: "3. QUY TRÌNH HỌC VIÊN XEM TÀI LIỆU",
  body: [
    p(
      "Quy trình do học viên thực hiện — từ lúc đăng nhập đến khi hoàn thành chương trình và nhận chứng nhận.",
    ),
    image("rIdImg2", imageEmu("diagram-2-view.png").cx, imageEmu("diagram-2-view.png").cy),
    para_after_image("Sơ đồ 2: Quy trình học viên xem tài liệu và hoàn thành khóa học."),
    p("Các bước chính:"),
    bullet("Bước 1 — Đăng nhập vào hệ thống."),
    bullet("Bước 2 — Xem danh sách chương trình được giao trong trang cá nhân."),
    bullet("Bước 3 — Chọn chương trình muốn học, sau đó chọn bài học cụ thể."),
    bullet("Bước 4 — Xem nội dung bài học: video bài giảng, tài liệu PDF, hoặc làm bài kiểm tra."),
    bullet("Bước 5 — Hoàn thành bài học: hệ thống tự động ghi nhận tiến độ."),
    bullet("Bước 6 — Nếu có bài kiểm tra: làm bài, nộp bài và xem kết quả. Nếu chưa đạt có thể làm lại."),
    bullet("Bước 7 — Hoàn thành tất cả bài học trong chương trình → nhận chứng nhận hoàn thành."),
    p(
      "Mọi hoạt động xem tài liệu và làm bài kiểm tra đều được hệ thống ghi lại để phục vụ báo cáo cho lãnh đạo.",
    ),
  ],
};

// Section 4 — manage system
const SECTION_4 = {
  title: "4. QUY TRÌNH QUẢN LÝ HỆ THỐNG",
  body: [
    p(
      "Quy trình dành cho Quản trị viên (quản lý nội dung, người dùng) và Lãnh đạo (theo dõi báo cáo).",
    ),
    image("rIdImg3", imageEmu("diagram-3-manage.png").cx, imageEmu("diagram-3-manage.png").cy),
    para_after_image("Sơ đồ 3: Quy trình quản lý hệ thống."),
    p("Đối với Quản trị viên (Admin):"),
    bullet("Quản lý người dùng: tạo tài khoản mới, phân quyền, khoá / mở khoá tài khoản."),
    bullet("Quản lý chương trình: tạo, chỉnh sửa, ẩn hoặc xoá chương trình đào tạo."),
    bullet("Quản lý bài học: kiểm duyệt nội dung video / tài liệu, sắp xếp thứ tự bài học."),
    bullet("Quản lý bài kiểm tra: tạo và chỉnh sửa đề thi, đặt thời gian và điểm đạt."),
    p("Đối với Lãnh đạo (Leader):"),
    bullet("Xem tiến độ học tập của từng nhân viên."),
    bullet("Xem báo cáo tổng hợp theo chương trình."),
    bullet("Xem báo cáo chi tiết theo từng cá nhân."),
    bullet("Xuất báo cáo để chia sẻ với các bên liên quan."),
    p(
      "Báo cáo được cập nhật theo thời gian thực, phản ánh đúng tiến độ học tập của từng học viên.",
    ),
  ],
};

// ---------- assemble word document --------------------------------------------

const wordDocument = (text) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>${text}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;

const stylesDocument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="44"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="2563EB"/></w:rPr>
  </w:style>
</w:styles>`;

const numberingDocument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const coreProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(TITLE)}</dc:title>
  <dc:creator>ePath System</dc:creator>
  <cp:lastModifiedBy>ePath System</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

const appProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ePath docx-builder</Application>
  <AppVersion>1.0</AppVersion>
</Properties>`;

// content types: add png default
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

// ---------- build document.xml -----------------------------------------------

// image references — keep stable rIds for relationships
const IMG_DEFS = [
  { name: "diagram-1-create.png", rId: "rIdImg1" },
  { name: "diagram-2-view.png",   rId: "rIdImg2" },
  { name: "diagram-3-manage.png", rId: "rIdImg3" },
];

// Patch image() to use rId map (rebuild call wrapper)
const imageRid = (filename, cx, cy) => {
  const def = IMG_DEFS.find((d) => d.name === filename);
  return image(def.rId, cx, cy);
};

const blocks = [];
blocks.push(
  `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(
    TITLE,
  )}</w:t></w:r></w:p>`,
);
blocks.push(
  `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="6B7280"/></w:rPr><w:t xml:space="preserve">Ngày tạo: ${new Date().toLocaleDateString(
    "vi-VN",
  )}</w:t></w:r></w:p>`,
);
blocks.push(p(INTRO));

blocks.push(heading(SECTION_1.title, 1));
SECTION_1.body.forEach((b) => blocks.push(b));

blocks.push(heading(SECTION_2.title, 1));
SECTION_2.body.forEach((b) => blocks.push(b));

blocks.push(heading(SECTION_3.title, 1));
SECTION_3.body.forEach((b) => blocks.push(b));

blocks.push(heading(SECTION_4.title, 1));
SECTION_4.body.forEach((b) => blocks.push(b));

const documentXml = wordDocument(blocks.join(""));

// ---------- relationships for images ------------------------------------------

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
${IMG_DEFS.map(
  (d) =>
    `  <Relationship Id="${d.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${d.name}"/>`,
).join("\n")}
</Relationships>`;

// ---------- zip --------------------------------------------------------------

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rootRels);
zip.file("docProps/core.xml", coreProps);
zip.file("docProps/app.xml", appProps);
zip.file("word/_rels/document.xml.rels", docRels);
zip.file("word/document.xml", documentXml);
zip.file("word/styles.xml", stylesDocument);
zip.file("word/numbering.xml", numberingDocument);

// embed PNGs as media
for (const def of IMG_DEFS) {
  const buf = readFileSync(resolve(process.cwd(), "scripts", def.name));
  zip.file(`word/media/${def.name}`, buf);
}

const buf = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
writeFileSync(OUT, buf);
console.log(`OK: wrote ${OUT} (${buf.length} bytes)`);
console.log(`Embedded ${IMG_DEFS.length} diagrams.`);
