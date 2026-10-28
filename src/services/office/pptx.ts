import JSZip from 'jszip';
import type { PresentationDocument, Slide, SlideElement } from '../../types';
import { downloadBlob } from '../files';

/**
 * Real `.pptx` export (basic fidelity).
 *
 * Text boxes, titles, shapes, images, per-element colours/sizes and slide
 * backgrounds are written into a valid OOXML presentation. Themes, transitions,
 * animations and speaker notes styling are not exported — the UI says so.
 */

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU_PER_PX = 12700; // 960×540 px → 12192000×6858000 EMU (16:9)
const SLIDE_W = 960;
const SLIDE_H = 540;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hex = (color: string | undefined, fallback: string) => {
  const value = (color ?? fallback).replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase();
  return fallback.replace('#', '').toUpperCase();
};

function themeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${A}" name="Concept">
<a:themeElements>
<a:clrScheme name="Concept">
<a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F1F5F9"/></a:lt2>
<a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="38BDF8"/></a:accent2>
<a:accent3><a:srgbClr val="8B5CF6"/></a:accent3><a:accent4><a:srgbClr val="22C55E"/></a:accent4>
<a:accent5><a:srgbClr val="F59E0B"/></a:accent5><a:accent6><a:srgbClr val="EF4444"/></a:accent6>
<a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Concept"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>`;
}

function masterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
}

function layoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function textBody(element: SlideElement, rtl: boolean): string {
  const lines = (element.text ?? '').split('\n');
  const align = element.align ?? 'left';
  const paragraphs = lines
    .map(
      (line) =>
        `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${Math.round((element.fontSize ?? 18) * 100)}" b="${element.bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${hex(element.color, '0F172A')}"/></a:solidFill><a:latin typeface="${escapeXml(element.fontFamily ?? 'Segoe UI')}"/><a:cs typeface="${escapeXml(element.fontFamily ?? 'Segoe UI')}"/></a:rPr><a:t>${escapeXml(line)}</a:t></a:r></a:p>`,
    )
    .join('');
  return `<p:txBody><a:bodyPr wrap="square" rtlCol="${rtl ? 1 : 0}" anchor="t"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paragraphs || '<a:p><a:endParaRPr lang="en-US"/></a:p>'}</p:txBody>`;
}

function shapeXml(element: SlideElement, id: number): string {
  const preset = element.shape === 'ellipse' ? 'ellipse' : element.shape === 'triangle' ? 'triangle' : element.shape === 'line' ? 'line' : 'rect';
  const fill = element.fill ? `<a:solidFill><a:srgbClr val="${hex(element.fill, '2563EB')}"/></a:solidFill>` : '<a:noFill/>';
  const line = element.stroke ? `<a:ln w="19050"><a:solidFill><a:srgbClr val="${hex(element.stroke, '1E3A8A')}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm rot="${Math.round((element.rotation ?? 0) * 60000)}"><a:off x="${Math.round(element.x * EMU_PER_PX)}" y="${Math.round(element.y * EMU_PER_PX)}"/><a:ext cx="${Math.round(element.w * EMU_PER_PX)}" cy="${Math.round(element.h * EMU_PER_PX)}"/></a:xfrm>
<a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}

function textBoxXml(element: SlideElement, id: number, rtl: boolean): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(element.type === 'title' ? 'Title' : 'Text')} ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${Math.round(element.x * EMU_PER_PX)}" y="${Math.round(element.y * EMU_PER_PX)}"/><a:ext cx="${Math.round(element.w * EMU_PER_PX)}" cy="${Math.round(element.h * EMU_PER_PX)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
${textBody(element, rtl)}</p:sp>`;
}

async function dataUrlToPng(src: string): Promise<{ base64: string; ext: string } | null> {
  if (src.startsWith('data:image/svg')) {
    // PowerPoint cannot embed SVG here — rasterise it first.
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('svg load failed'));
        image.src = src;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || SLIDE_W;
      canvas.height = image.naturalHeight || SLIDE_H;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0);
      const png = canvas.toDataURL('image/png');
      return { base64: png.split(',')[1], ext: 'png' };
    } catch {
      return null;
    }
  }
  const match = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i.exec(src);
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'jpeg' || match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  return { base64: match[2], ext };
}

export async function exportPptx(doc: PresentationDocument, filename: string): Promise<void> {
  const zip = new JSZip();
  const slideCount = doc.slides.length;
  const media: { path: string; base64: string }[] = [];

  const slideXmls: string[] = [];
  const slideRels: string[] = [];

  for (let index = 0; index < slideCount; index += 1) {
    const slide: Slide = doc.slides[index];
    const shapes: string[] = [];
    const rels: string[] = [];
    let shapeId = 2;

    for (const element of slide.elements) {
      if (element.type === 'image' && element.src) {
        const image = await dataUrlToPng(element.src);
        if (!image) continue;
        const mediaIndex = media.length + 1;
        const ext = image.ext === 'webp' || image.ext === 'gif' ? 'png' : image.ext;
        media.push({ path: `ppt/media/image${mediaIndex}.${ext}`, base64: image.base64 });
        const relId = `rId${rels.length + 2}`;
        rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${mediaIndex}.${ext}"/>`);
        shapes.push(
          `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="Picture ${shapeId}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${Math.round(element.x * EMU_PER_PX)}" y="${Math.round(element.y * EMU_PER_PX)}"/><a:ext cx="${Math.round(element.w * EMU_PER_PX)}" cy="${Math.round(element.h * EMU_PER_PX)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`,
        );
        shapeId += 1;
        continue;
      }
      if (element.type === 'shape') {
        shapes.push(shapeXml(element, shapeId));
      } else {
        shapes.push(textBoxXml(element, shapeId, false));
      }
      shapeId += 1;
    }

    slideXmls.push(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(slide.background, 'FFFFFF')}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes.join('\n')}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    );

    slideRels.push(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
${rels.join('')}
</Relationships>`,
    );
  }

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${doc.slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
</Types>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );

  const ppt = zip.folder('ppt');
  ppt?.file(
    'presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${doc.slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')}</p:sldIdLst>
<p:sldSz cx="${SLIDE_W * EMU_PER_PX}" cy="${SLIDE_H * EMU_PER_PX}" type="screen16x9"/>
<p:notesSz cx="${SLIDE_H * EMU_PER_PX}" cy="${SLIDE_W * EMU_PER_PX}"/>
</p:presentation>`,
  );
  ppt?.folder('_rels')?.file(
    'presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${doc.slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')}
<Relationship Id="rId${doc.slides.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
  );
  ppt?.folder('slideMasters')?.file('slideMaster1.xml', masterXml());
  ppt?.folder('slideMasters')?.folder('_rels')?.file(
    'slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  );
  ppt?.folder('slideLayouts')?.file('slideLayout1.xml', layoutXml());
  ppt?.folder('slideLayouts')?.folder('_rels')?.file(
    'slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  );
  ppt?.folder('theme')?.file('theme1.xml', themeXml());

  const slides = ppt?.folder('slides');
  slideXmls.forEach((xml, index) => {
    slides?.file(`slide${index + 1}.xml`, xml);
  });
  const slideRelsFolder = slides?.folder('_rels');
  slideRels.forEach((xml, index) => {
    slideRelsFolder?.file(`slide${index + 1}.xml.rels`, xml);
  });
  media.forEach((item) => zip.file(item.path, item.base64, { base64: true }));

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  downloadBlob(blob, filename.endsWith('.pptx') ? filename : `${filename}.pptx`);
}
