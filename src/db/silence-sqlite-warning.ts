/**
 * Node.js avisa de que node:sqlite es "experimental" cada vez que se carga.
 * Funciona perfectamente; ocultamos solo ese aviso para no confundir en los logs.
 * Este archivo debe importarse ANTES de "node:sqlite".
 */
const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning.message;
  if (text.includes("SQLite is an experimental feature")) return;
  return (originalEmitWarning as (...a: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;
