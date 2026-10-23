/**
 * De dónde sale cada pregunta: la ley, su ubicación dentro de la ley (Título,
 * Capítulo, Sección…) y el enlace al texto oficial en el BOE.
 *
 * Para las leyes con estructura conocida (Constitución, Ley 39/2015 y Ley 40/2015)
 * se calcula todo automáticamente a partir del artículo de referencia (ej:
 * "Art. 17.2 CE"). Para otras leyes, el JSON de preguntas puede indicar
 * "ubicacion" y "enlace" a mano.
 */

/** Tramo de artículos (ambos incluidos) con su nombre */
interface Range {
  from: number;
  to: number;
  name: string;
}

interface Title extends Range {
  /** Número romano del Título ("Preliminar", "I", "II"…) */
  numeral: string;
  /** Tema al que pertenecen sus artículos (salvo que un tramo de `topics` diga otro) */
  topic: string;
}

interface LawStructure {
  titles: Title[];
  /** Capítulos (solo de los Títulos que los tienen y que conocemos con seguridad) */
  chapters: Range[];
  sections: Range[];
  /** Temas más finos que el Título, para Títulos muy grandes */
  topics?: Range[];
  /** Tema de las preguntas generales (fecha, estructura, reformas…) */
  generalTopic: string;
  /** Tema de las disposiciones adicionales, transitorias, derogatoria y finales */
  provisionsTopic: string;
  /** La disposición derogatoria es "única" (cambia el ancla del BOE) */
  singleRepeal: boolean;
}

export interface LawInfo {
  /** Nombre que se muestra, ej: "Constitución Española" */
  name: string;
  /** Abreviatura habitual, ej: "CE" */
  short: string;
  /** Nombre para los botones del menú */
  label: string;
  /** Identificador del texto consolidado en el BOE */
  boeId: string;
  /** Reconoce la ley dentro del texto del artículo de referencia */
  pattern: RegExp;
  structure?: LawStructure;
  /** Orden de la ley en los menús */
  order: number;
}

// ---------------------------------------------------------------------------
// Constitución Española
// ---------------------------------------------------------------------------

export const CE_NAME = "Constitución Española";
/** Tema para preguntas generales: Preámbulo, estructura, fechas y reformas */
export const CE_TOPIC_GENERAL = "Preámbulo, estructura y reformas";
/** Tema para las disposiciones adicionales, transitorias, derogatoria y final */
export const CE_TOPIC_PROVISIONS = "Disposiciones de la CE";

const CE: LawStructure = {
  titles: [
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
  ],
  chapters: [
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
  ],
  sections: [
    { from: 15, to: 29, name: "Sección 1.ª De los derechos fundamentales y de las libertades públicas" },
    { from: 30, to: 38, name: "Sección 2.ª De los derechos y deberes de los ciudadanos" },
  ],
  generalTopic: CE_TOPIC_GENERAL,
  provisionsTopic: CE_TOPIC_PROVISIONS,
  singleRepeal: false,
};

// ---------------------------------------------------------------------------
// Ley 39/2015, del Procedimiento Administrativo Común
// ---------------------------------------------------------------------------

const LEY39: LawStructure = {
  titles: [
    {
      from: 1,
      to: 2,
      numeral: "Preliminar",
      name: "Título preliminar. Disposiciones generales",
      topic: "Título Preliminar · Objeto y ámbito",
    },
    {
      from: 3,
      to: 12,
      numeral: "I",
      name: "Título I. De los interesados en el procedimiento",
      topic: "Título I · Los interesados",
    },
    {
      from: 13,
      to: 33,
      numeral: "II",
      name: "Título II. De la actividad de las Administraciones Públicas",
      topic: "Título II · Actividad de las Administraciones",
    },
    { from: 34, to: 52, numeral: "III", name: "Título III. De los actos administrativos", topic: "Título III · Actos administrativos" },
    {
      from: 53,
      to: 105,
      numeral: "IV",
      name: "Título IV. De las disposiciones sobre el procedimiento administrativo común",
      topic: "Título IV · Procedimiento administrativo común",
    },
    {
      from: 106,
      to: 126,
      numeral: "V",
      name: "Título V. De la revisión de los actos en vía administrativa",
      topic: "Título V · Revisión de los actos",
    },
    {
      from: 127,
      to: 133,
      numeral: "VI",
      name: "Título VI. De la iniciativa legislativa y de la potestad para dictar reglamentos y otras disposiciones",
      topic: "Título VI · Iniciativa legislativa y reglamentos",
    },
  ],
  chapters: [
    { from: 3, to: 8, name: "Capítulo I. La capacidad de obrar y el concepto de interesado" },
    { from: 9, to: 12, name: "Capítulo II. Identificación y firma de los interesados en el procedimiento administrativo" },
    { from: 13, to: 28, name: "Capítulo I. Normas generales de actuación" },
    { from: 29, to: 33, name: "Capítulo II. Términos y plazos" },
    { from: 34, to: 36, name: "Capítulo I. Requisitos de los actos administrativos" },
    { from: 37, to: 46, name: "Capítulo II. Eficacia de los actos" },
    { from: 47, to: 52, name: "Capítulo III. Nulidad y anulabilidad" },
    { from: 53, to: 53, name: "Capítulo I. Garantías del procedimiento" },
    { from: 54, to: 69, name: "Capítulo II. Iniciación del procedimiento" },
    { from: 70, to: 74, name: "Capítulo III. Ordenación del procedimiento" },
    { from: 75, to: 83, name: "Capítulo IV. Instrucción del procedimiento" },
    { from: 84, to: 95, name: "Capítulo V. Finalización del procedimiento" },
    { from: 96, to: 96, name: "Capítulo VI. De la tramitación simplificada del procedimiento administrativo común" },
    { from: 97, to: 105, name: "Capítulo VII. Ejecución" },
    { from: 106, to: 111, name: "Capítulo I. Revisión de oficio" },
    { from: 112, to: 126, name: "Capítulo II. Recursos administrativos" },
  ],
  sections: [
    { from: 54, to: 57, name: "Sección 1.ª Disposiciones generales" },
    { from: 58, to: 65, name: "Sección 2.ª Iniciación del procedimiento de oficio por la Administración" },
    { from: 66, to: 69, name: "Sección 3.ª Inicio del procedimiento a solicitud del interesado" },
    { from: 75, to: 76, name: "Sección 1.ª Disposiciones generales" },
    { from: 77, to: 78, name: "Sección 2.ª Prueba" },
    { from: 79, to: 81, name: "Sección 3.ª Informes" },
    { from: 82, to: 83, name: "Sección 4.ª Participación de los interesados" },
    { from: 84, to: 86, name: "Sección 1.ª Disposiciones generales" },
    { from: 87, to: 92, name: "Sección 2.ª Resolución" },
    { from: 93, to: 94, name: "Sección 3.ª Desistimiento y renuncia" },
    { from: 95, to: 95, name: "Sección 4.ª Caducidad" },
    { from: 112, to: 120, name: "Sección 1.ª Principios generales" },
    { from: 121, to: 122, name: "Sección 2.ª Recurso de alzada" },
    { from: 123, to: 124, name: "Sección 3.ª Recurso potestativo de reposición" },
    { from: 125, to: 126, name: "Sección 4.ª Recurso extraordinario de revisión" },
  ],
  topics: [
    { from: 13, to: 28, name: "Título II · Normas generales de actuación" },
    { from: 29, to: 33, name: "Título II · Términos y plazos" },
    { from: 53, to: 69, name: "Título IV · Garantías e iniciación" },
    { from: 70, to: 83, name: "Título IV · Ordenación e instrucción" },
    { from: 84, to: 105, name: "Título IV · Finalización y ejecución" },
    { from: 106, to: 111, name: "Título V · Revisión de oficio" },
    { from: 112, to: 126, name: "Título V · Recursos administrativos" },
  ],
  generalTopic: "Aspectos generales de la Ley 39/2015",
  provisionsTopic: "Disposiciones de la Ley 39/2015",
  singleRepeal: true,
};

// ---------------------------------------------------------------------------
// Ley 40/2015, de Régimen Jurídico del Sector Público
// ---------------------------------------------------------------------------

const LEY40: LawStructure = {
  titles: [
    {
      from: 1,
      to: 53,
      numeral: "Preliminar",
      name: "Título preliminar. Disposiciones generales, principios de actuación y funcionamiento del sector público",
      topic: "Título Preliminar",
    },
    // Del Título I solo se indica el Título (no se muestran sus capítulos)
    { from: 54, to: 80, numeral: "I", name: "Título I. Administración General del Estado", topic: "Título I · Administración General del Estado" },
    {
      from: 81,
      to: 139,
      numeral: "II",
      name: "Título II. Organización y funcionamiento del sector público institucional",
      topic: "Título II · Sector público institucional",
    },
    { from: 140, to: 158, numeral: "III", name: "Título III. Relaciones interadministrativas", topic: "Título III · Relaciones interadministrativas" },
  ],
  chapters: [
    { from: 1, to: 4, name: "Capítulo I. Disposiciones generales" },
    { from: 5, to: 24, name: "Capítulo II. De los órganos de las Administraciones Públicas" },
    { from: 25, to: 31, name: "Capítulo III. Principios de la potestad sancionadora" },
    { from: 32, to: 37, name: "Capítulo IV. De la responsabilidad patrimonial de las Administraciones Públicas" },
    { from: 38, to: 46, name: "Capítulo V. Funcionamiento electrónico del sector público" },
    { from: 47, to: 53, name: "Capítulo VI. De los convenios" },
    { from: 81, to: 83, name: "Capítulo I. Del sector público institucional" },
    { from: 84, to: 87, name: "Capítulo II. Organización y funcionamiento del sector público institucional estatal" },
    { from: 88, to: 108, name: "Capítulo III. De los organismos públicos estatales" },
    { from: 109, to: 110, name: "Capítulo IV. De las autoridades administrativas independientes de ámbito estatal" },
    { from: 111, to: 117, name: "Capítulo V. De las sociedades mercantiles estatales" },
    { from: 118, to: 127, name: "Capítulo VI. De los consorcios" },
    { from: 128, to: 136, name: "Capítulo VII. De las fundaciones del sector público estatal" },
    { from: 137, to: 139, name: "Capítulo VIII. De los fondos sin personalidad jurídica" },
    { from: 140, to: 140, name: "Capítulo I. Principios generales de las relaciones interadministrativas" },
    { from: 141, to: 142, name: "Capítulo II. Deber de colaboración" },
    { from: 143, to: 154, name: "Capítulo III. Relaciones de cooperación" },
    { from: 155, to: 158, name: "Capítulo IV. Relaciones electrónicas entre las Administraciones" },
  ],
  sections: [
    { from: 5, to: 7, name: "Sección 1.ª Órganos administrativos" },
    { from: 8, to: 14, name: "Sección 2.ª Competencia" },
    { from: 15, to: 22, name: "Sección 3.ª Órganos colegiados de las distintas administraciones públicas" },
    { from: 23, to: 24, name: "Sección 4.ª Abstención y recusación" },
    { from: 32, to: 35, name: "Sección 1.ª Disposiciones generales" },
    { from: 36, to: 37, name: "Sección 2.ª Responsabilidad de las autoridades y personal al servicio de las Administraciones Públicas" },
  ],
  topics: [
    { from: 1, to: 4, name: "T. Preliminar · Disposiciones generales y principios" },
    { from: 5, to: 14, name: "T. Preliminar · Órganos y competencia" },
    { from: 15, to: 22, name: "T. Preliminar · Órganos colegiados" },
    { from: 23, to: 24, name: "T. Preliminar · Abstención y recusación" },
    { from: 25, to: 31, name: "T. Preliminar · Potestad sancionadora" },
    { from: 32, to: 37, name: "T. Preliminar · Responsabilidad patrimonial" },
    { from: 38, to: 46, name: "T. Preliminar · Funcionamiento electrónico" },
    { from: 47, to: 53, name: "T. Preliminar · Convenios" },
  ],
  generalTopic: "Aspectos generales de la Ley 40/2015",
  provisionsTopic: "Disposiciones de la Ley 40/2015",
  singleRepeal: true,
};

/** Leyes conocidas. Para añadir una, basta con su id del BOE (aparece en la URL del texto consolidado). */
export const LAWS: LawInfo[] = [
  {
    name: CE_NAME,
    short: "CE",
    label: "Constitución Española",
    boeId: "BOE-A-1978-31229",
    pattern: /\bCE\b|Constituci[oó]n/i,
    structure: CE,
    order: 0,
  },
  {
    name: "Ley 39/2015, del Procedimiento Administrativo Común",
    short: "Ley 39/2015",
    label: "Ley 39/2015 · Procedimiento",
    boeId: "BOE-A-2015-10565",
    pattern: /Ley\s*39\/2015/i,
    structure: LEY39,
    order: 1,
  },
  {
    name: "Ley 40/2015, de Régimen Jurídico del Sector Público",
    short: "Ley 40/2015",
    label: "Ley 40/2015 · Sector Público",
    boeId: "BOE-A-2015-10566",
    pattern: /Ley\s*40\/2015/i,
    structure: LEY40,
    order: 2,
  },
  {
    name: "Estatuto Básico del Empleado Público (TREBEP)",
    short: "TREBEP",
    label: "TREBEP · Empleado Público",
    boeId: "BOE-A-2015-11719",
    pattern: /TREBEP|\bEBEP\b|Real Decreto Legislativo 5\/2015|RDL(?:eg)?\.?\s*5\/2015/i,
    order: 3,
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
// Localizar un artículo dentro de su ley
// ---------------------------------------------------------------------------

const CHAPTER_ORDINALS = ["primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "septimo", "octavo"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const inRange = (n: number) => (r: Range) => n >= r.from && n <= r.to;

/** Primer artículo que aparece en la referencia ("Art. 62 y art. 97 CE" → 62; "Art. 46 bis" → 46 bis) */
export function articleRef(reference: string): { number: number; bis: boolean } | null {
  const m = reference.match(/\bart(?:[ií]culo|\.)?\s*(\d+)(\s*bis\b)?/i);
  return m ? { number: Number(m[1]), bis: Boolean(m[2]) } : null;
}

/** Quita tildes y pasa a minúsculas ("Décima" → "decima") */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface Location {
  /** Ubicación de mayor a menor: Título, Capítulo, Sección */
  location: string[];
  /** Tema al que pertenece la pregunta */
  topic: string;
  /** Ancla del BOE para ir directamente al artículo (sin "#"), si se conoce */
  anchor?: string;
}

/**
 * Ubicación dentro de una ley con estructura conocida a partir de la referencia.
 * Ejemplos: "Art. 17.2 CE", "Art. 46 bis Ley 40/2015", "Título VI CE",
 * "Título I, Capítulo III CE", "Disposición adicional primera CE", "Preámbulo CE".
 */
export function locate(law: LawInfo, reference: string): Location | undefined {
  const s = law.structure;
  if (!s) return undefined;

  const art = articleRef(reference);
  const lastArticle = s.titles[s.titles.length - 1].to;
  if (art && art.number >= 1 && art.number <= lastArticle) {
    const title = s.titles.find(inRange(art.number))!;
    const location = [title.name];
    const chapter = s.chapters.find(inRange(art.number));
    if (chapter) location.push(chapter.name);
    const section = s.sections.find(inRange(art.number));
    if (section) location.push(section.name);
    const topic = s.topics?.find(inRange(art.number))?.name ?? title.topic;
    return { location, topic, anchor: `a${art.number}${art.bis ? "bis" : ""}` };
  }

  const p = plain(reference);

  const disposition = p.match(/disposicion\s+(adicional|transitoria|derogatoria|final)\s*([a-z]*)/);
  if (disposition) {
    const [, kind, ordinal] = disposition;
    // Anclas del BOE: "daprimera", "dtsegunda", "ddunica", "dfprimera"…
    let anchor: string | undefined;
    if (kind === "derogatoria") anchor = s.singleRepeal ? "ddunica" : undefined;
    else if (ordinal) anchor = `d${kind[0]}${ordinal}`;
    // La derogatoria (y la final única de la CE) no forman grupo: basta con la referencia
    if (kind === "derogatoria" || !ordinal) return { location: [], topic: s.provisionsTopic, anchor };
    const groups: Record<string, string> = {
      adicional: "Disposiciones adicionales",
      transitoria: "Disposiciones transitorias",
      final: "Disposiciones finales",
    };
    return { location: [groups[kind]], topic: s.provisionsTopic, anchor };
  }

  if (p.includes("preambulo") || p.includes("exposicion de motivos")) {
    return { location: [p.includes("preambulo") ? "Preámbulo" : "Exposición de motivos"], topic: s.generalTopic };
  }

  const titleMatch = reference.match(/T[ií]tulo\s+(Preliminar|[IVX]+)\b/i);
  if (titleMatch) {
    const numeral = /preliminar/i.test(titleMatch[1]) ? "Preliminar" : titleMatch[1].toUpperCase();
    const title = s.titles.find((t) => t.numeral === numeral);
    if (title) {
      const location = [title.name];
      const chapterMatch = p.match(/capitulo\s+(primero|segundo|tercero|cuarto|quinto|sexto|septimo|octavo|[ivx]+)\b/);
      if (chapterMatch) {
        const raw = chapterMatch[1];
        const index = CHAPTER_ORDINALS.includes(raw) ? CHAPTER_ORDINALS.indexOf(raw) : ROMAN.indexOf(raw.toUpperCase());
        const chapters = s.chapters.filter((c) => c.from >= title.from && c.to <= title.to);
        if (chapters[index]) location.push(chapters[index].name);
      }
      return { location, topic: title.topic };
    }
  }

  // Preguntas generales: fecha, número de artículos, reformas…
  return { location: [], topic: s.generalTopic };
}

/** Atajo para la Constitución */
export function locateCE(reference: string): Location {
  return locate(LAWS[0], reference)!;
}

/** Orden de los temas de una ley con estructura conocida (Títulos y sus divisiones, en orden) */
export function topicOrder(law: LawInfo): string[] {
  const s = law.structure;
  if (!s) return [];
  const byArticle: { from: number; name: string }[] = [];
  for (const t of s.titles) {
    const finer = (s.topics ?? []).filter((r) => r.from >= t.from && r.to <= t.to);
    if (finer.length > 0) {
      for (const f of finer) byArticle.push({ from: f.from, name: f.name });
      // Si los temas finos no cubren todo el Título, el resto queda con el nombre del Título
      if (finer[0].from > t.from || finer.some((f, i) => i > 0 && f.from !== finer[i - 1].to + 1) || finer[finer.length - 1].to < t.to) {
        byArticle.push({ from: t.from, name: t.topic });
      }
    } else {
      byArticle.push({ from: t.from, name: t.topic });
    }
  }
  byArticle.sort((a, b) => a.from - b.from);
  return [s.generalTopic, ...byArticle.map((t) => t.name), s.provisionsTopic];
}

/** Posición de un tema en los menús: primero por ley y después por su orden dentro de la ley */
export function topicPosition(lawName: string, topic: string, appearance: number): number {
  const law = findLaw(lawName);
  if (!law) return 100_000 + appearance;
  const index = topicOrder(law).indexOf(topic);
  return law.order * 1000 + (index >= 0 ? index : 500 + appearance);
}

/** Enlace al texto oficial en el BOE (al artículo concreto cuando es posible) */
export function boeUrl(law: LawInfo, anchor?: string): string {
  const base = `https://www.boe.es/buscar/act.php?id=${law.boeId}`;
  return anchor ? `${base}#${anchor}` : base;
}

/** Ancla del BOE para un artículo de cualquier ley ("Art. 21.3 Ley 39/2015" → "a21") */
export function articleAnchor(reference: string): string | undefined {
  const art = articleRef(reference);
  return art ? `a${art.number}${art.bis ? "bis" : ""}` : undefined;
}

/** Nombre corto de una ley para los botones ("Ley 39/2015 · Procedimiento Administrativo") */
export function lawLabel(lawName: string): string {
  return findLaw(lawName)?.label ?? lawName;
}

/** Abreviatura de una ley ("CE", "Ley 39/2015"…) o el propio nombre si no se conoce */
export function lawShort(lawName: string): string {
  return findLaw(lawName)?.short ?? lawName;
}
