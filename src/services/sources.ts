/**
 * De dónde sale cada pregunta: la ley, su ubicación dentro de la ley (Título,
 * Capítulo, Sección…) y el enlace al texto oficial en el BOE.
 *
 * Para la Constitución se calcula todo automáticamente a partir del artículo
 * de referencia (ej: "Art. 17.2 CE"). Para otras leyes, el JSON de preguntas
 * puede indicar "ubicacion" y "enlace" a mano.
 */

export interface LawInfo {
  /** Nombre que se muestra, ej: "Constitución Española" */
  name: string;
  /** Abreviatura habitual, ej: "CE" */
  short: string;
  /** Identificador del texto consolidado en el BOE */
  boeId: string;
  /** Reconoce la ley dentro del texto del artículo de referencia */
  pattern: RegExp;
}

export const CE_NAME = "Constitución Española";

/** Leyes conocidas. Para añadir una, basta con su id del BOE (aparece en la URL del texto consolidado). */
export const LAWS: LawInfo[] = [
  { name: CE_NAME, short: "CE", boeId: "BOE-A-1978-31229", pattern: /\bCE\b|Constituci[oó]n/i },
  {
    name: "Ley 39/2015, del Procedimiento Administrativo Común",
    short: "Ley 39/2015",
    boeId: "BOE-A-2015-10565",
    pattern: /Ley\s*39\/2015/i,
  },
  {
    name: "Ley 40/2015, de Régimen Jurídico del Sector Público",
    short: "Ley 40/2015",
    boeId: "BOE-A-2015-10566",
    pattern: /Ley\s*40\/2015/i,
  },
  {
    name: "Estatuto Básico del Empleado Público (TREBEP)",
    short: "TREBEP",
    boeId: "BOE-A-2015-11719",
    pattern: /TREBEP|\bEBEP\b|Real Decreto Legislativo 5\/2015|RDL(?:eg)?\.?\s*5\/2015/i,
  },
];

/** Busca una ley por su nombre, su abreviatura o el texto del artículo de referencia */
export function findLaw(text: string | undefined): LawInfo | undefined {
  if (!text) return undefined;
  const t = text.trim().toLowerCase();
  return (
    LAWS.find((l) => l.name.toLowerCase() === t || l.short.toLowerCase() === t) ??
    LAWS.find((l) => l.pattern.test(text))
  );
}

// ---------------------------------------------------------------------------
// Estructura de la Constitución Española
// ---------------------------------------------------------------------------

interface Range {
  from: number;
  to: number;
  name: string;
}

interface CeTitle extends Range {
  /** Número romano del Título ("Preliminar", "I", "II"…) */
  numeral: string;
  /** Nombre corto del tema para el menú "Por temas" y las estadísticas */
  topic: string;
}

/** Tema para preguntas generales: Preámbulo, estructura, fechas y reformas */
export const CE_TOPIC_GENERAL = "Preámbulo, estructura y reformas";
/** Tema para las disposiciones adicionales, transitorias, derogatoria y final */
export const CE_TOPIC_PROVISIONS = "Disposiciones de la CE";

const CE_TITLES: CeTitle[] = [
  { from: 1, to: 9, numeral: "Preliminar", name: "Título Preliminar", topic: "Título Preliminar" },
  {
    from: 10,
    to: 55,
    numeral: "I",
    name: "Título I. De los derechos y deberes fundamentales",
    topic: "Título I · Derechos y deberes fundamentales",
  },
  { from: 56, to: 65, numeral: "II", name: "Título II. De la Corona", topic: "Título II · La Corona" },
  { from: 66, to: 96, numeral: "III", name: "Título III. De las Cortes Generales", topic: "Título III · Las Cortes Generales" },
  {
    from: 97,
    to: 107,
    numeral: "IV",
    name: "Título IV. Del Gobierno y de la Administración",
    topic: "Título IV · Gobierno y Administración",
  },
  {
    from: 108,
    to: 116,
    numeral: "V",
    name: "Título V. De las relaciones entre el Gobierno y las Cortes Generales",
    topic: "Título V · Gobierno y Cortes Generales",
  },
  { from: 117, to: 127, numeral: "VI", name: "Título VI. Del Poder Judicial", topic: "Título VI · Poder Judicial" },
  { from: 128, to: 136, numeral: "VII", name: "Título VII. Economía y Hacienda", topic: "Título VII · Economía y Hacienda" },
  {
    from: 137,
    to: 158,
    numeral: "VIII",
    name: "Título VIII. De la Organización Territorial del Estado",
    topic: "Título VIII · Organización territorial",
  },
  {
    from: 159,
    to: 165,
    numeral: "IX",
    name: "Título IX. Del Tribunal Constitucional",
    topic: "Título IX · Tribunal Constitucional",
  },
  {
    from: 166,
    to: 169,
    numeral: "X",
    name: "Título X. De la reforma constitucional",
    topic: "Título X · Reforma constitucional",
  },
];

/** Capítulos (solo los Títulos I, III y VIII están divididos en capítulos) */
const CE_CHAPTERS: Range[] = [
  { from: 11, to: 13, name: "Capítulo primero. De los españoles y los extranjeros" },
  { from: 14, to: 38, name: "Capítulo segundo. Derechos y libertades" },
  { from: 39, to: 52, name: "Capítulo tercero. De los principios rectores de la política social y económica" },
  { from: 53, to: 54, name: "Capítulo cuarto. De las garantías de las libertades y derechos fundamentales" },
  { from: 55, to: 55, name: "Capítulo quinto. De la suspensión de los derechos y libertades" },
  { from: 66, to: 80, name: "Capítulo primero. De las Cámaras" },
  { from: 81, to: 92, name: "Capítulo segundo. De la elaboración de las leyes" },
  { from: 93, to: 96, name: "Capítulo tercero. De los Tratados Internacionales" },
  { from: 137, to: 139, name: "Capítulo primero. Principios generales" },
  { from: 140, to: 142, name: "Capítulo segundo. De la Administración Local" },
  { from: 143, to: 158, name: "Capítulo tercero. De las Comunidades Autónomas" },
];

/** Secciones del Capítulo segundo del Título I */
const CE_SECTIONS: Range[] = [
  { from: 15, to: 29, name: "Sección 1.ª De los derechos fundamentales y de las libertades públicas" },
  { from: 30, to: 38, name: "Sección 2.ª De los derechos y deberes de los ciudadanos" },
];

/** Orden en que aparecen los temas de la CE en el menú */
export const CE_TOPIC_ORDER = [CE_TOPIC_GENERAL, ...CE_TITLES.map((t) => t.topic), CE_TOPIC_PROVISIONS];

const CHAPTER_ORDINALS = ["primero", "segundo", "tercero", "cuarto", "quinto"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const inRange = (n: number) => (r: Range) => n >= r.from && n <= r.to;

/** Primer número de artículo que aparece en la referencia ("Art. 62 y art. 97 CE" → 62) */
export function articleNumber(reference: string): number | null {
  const m = reference.match(/\bart(?:[ií]culo|\.)?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Quita tildes y pasa a minúsculas ("Décima" → "decima") */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface CeLocation {
  /** Ubicación de mayor a menor: Título, Capítulo, Sección */
  location: string[];
  /** Tema al que pertenece la pregunta */
  topic: string;
  /** Ancla del BOE para ir directamente al artículo (sin "#"), si se conoce */
  anchor?: string;
}

/**
 * Ubicación dentro de la Constitución a partir de la referencia.
 * Ejemplos: "Art. 17.2 CE", "Título VI CE", "Título I, Capítulo III CE",
 * "Disposición adicional primera CE", "Preámbulo CE".
 */
export function locateCE(reference: string): CeLocation {
  const art = articleNumber(reference);
  if (art !== null && art >= 1 && art <= 169) {
    const title = CE_TITLES.find(inRange(art))!;
    const location = [title.name];
    const chapter = CE_CHAPTERS.find(inRange(art));
    if (chapter) location.push(chapter.name);
    const section = CE_SECTIONS.find(inRange(art));
    if (section) location.push(section.name);
    return { location, topic: title.topic, anchor: `a${art}` };
  }

  const p = plain(reference);

  const disposition = p.match(/disposicion\s+(adicional|transitoria|derogatoria|final)\s*([a-z]*)/);
  if (disposition) {
    const [, kind, ordinal] = disposition;
    const label = {
      adicional: "Disposiciones adicionales",
      transitoria: "Disposiciones transitorias",
      derogatoria: "Disposición derogatoria",
      final: "Disposición final",
    }[kind as "adicional" | "transitoria" | "derogatoria" | "final"];
    const anchor =
      (kind === "adicional" || kind === "transitoria") && ordinal ? `d${kind[0]}${ordinal}` : undefined;
    return { location: [label], topic: CE_TOPIC_PROVISIONS, anchor };
  }

  if (p.includes("preambulo")) return { location: ["Preámbulo"], topic: CE_TOPIC_GENERAL };

  const titleMatch = reference.match(/T[ií]tulo\s+(Preliminar|[IVX]+)\b/i);
  if (titleMatch) {
    const numeral = /preliminar/i.test(titleMatch[1]) ? "Preliminar" : titleMatch[1].toUpperCase();
    const title = CE_TITLES.find((t) => t.numeral === numeral);
    if (title) {
      const location = [title.name];
      const chapterMatch = p.match(/capitulo\s+(primero|segundo|tercero|cuarto|quinto|[ivx]+)\b/);
      if (chapterMatch) {
        const raw = chapterMatch[1];
        const index = CHAPTER_ORDINALS.includes(raw)
          ? CHAPTER_ORDINALS.indexOf(raw)
          : ROMAN.indexOf(raw.toUpperCase());
        const chapters = CE_CHAPTERS.filter((c) => c.from >= title.from && c.to <= title.to);
        if (chapters[index]) location.push(chapters[index].name);
      }
      return { location, topic: title.topic };
    }
  }

  // Preguntas generales: número de artículos, fecha de publicación, reformas…
  return { location: [], topic: CE_TOPIC_GENERAL };
}

/** Enlace al texto oficial en el BOE (al artículo concreto cuando es posible) */
export function boeUrl(law: LawInfo, anchor?: string): string {
  const base = `https://www.boe.es/buscar/act.php?id=${law.boeId}`;
  return anchor ? `${base}#${anchor}` : base;
}

/** Ancla del BOE para un artículo de cualquier ley ("Art. 21.3 Ley 39/2015" → "a21") */
export function articleAnchor(reference: string): string | undefined {
  const art = articleNumber(reference);
  return art !== null ? `a${art}` : undefined;
}
