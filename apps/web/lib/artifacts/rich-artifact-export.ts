import { defaultDocumentContent, defaultPresentationDeck, type PresentationDeck, type PresentationSlide } from './rich-artifacts'

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function textLines(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '• '))
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function u32(value: number) {
  const buffer = Buffer.allocUnsafe(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

function zipFiles(files: Array<{ name: string; data: string | Buffer }>) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8')
    const name = Buffer.from(file.name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ])
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralDir = Buffer.concat(centrals)
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
    u32(centralDir.length), u32(offset), u16(0),
  ])
  return Buffer.concat([...locals, centralDir, end])
}

export function createDocxBuffer(title: string, markdown: string) {
  const paragraphs = textLines(markdown || defaultDocumentContent(title))
  const body = paragraphs.map((line) => {
    return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
  }).join('')
  return zipFiles([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '</Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>',
    },
    {
      name: 'word/document.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>`
        + '</w:document>',
    },
  ])
}

function slideXml(slide: PresentationSlide) {
  const lines = [slide.title, ...slide.body]
  const paragraphs = lines.map((line, index) => {
    const fontSize = index === 0 ? 3200 : 2000
    return `<a:p><a:r><a:rPr lang="zh-CN" sz="${fontSize}"/><a:t>${xmlEscape(line)}</a:t></a:r></a:p>`
  }).join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
    + '<p:cSld><p:spTree>'
    + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="内容"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="685800"/><a:ext cx="7772400" cy="4572000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
    + `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
}

export function createPptxBuffer(deck: PresentationDeck) {
  const slides = deck.slides.length > 0 ? deck.slides : defaultPresentationDeck(deck.title).slides
  const overrides = slides.map((_, index) => {
    return `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  }).join('')
  const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('')
  const relationships = slides.map((_, index) => {
    return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
  }).join('')
  return zipFiles([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        + overrides
        + '</Types>',
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
        + '</Relationships>',
    },
    {
      name: 'ppt/presentation.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        + `<p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    },
    ...slides.map((slide, index) => ({
      name: `ppt/slides/slide${index + 1}.xml`,
      data: slideXml(slide),
    })),
  ])
}
