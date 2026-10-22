/**
 * Borra de la base de datos las preguntas de ejemplo (las que empiezan por
 * "[EJEMPLO - REVISAR]"), las respuestas que los usuarios hayan dado a ellas
 * y sus publicaciones en el canal.
 *
 * Uso: npm run borrar-ejemplos
 */
import { db } from "../db/database";
import { countQuestions } from "../db/questions";

const EXAMPLE_FILTER = "SELECT id FROM questions WHERE statement LIKE '[EJEMPLO - REVISAR]%'";

db.exec("BEGIN");
try {
  const answers = db.prepare(`DELETE FROM answers WHERE question_id IN (${EXAMPLE_FILTER})`).run();
  db.prepare(`DELETE FROM channel_posts WHERE question_id IN (${EXAMPLE_FILTER})`).run();
  const questions = db.prepare(`DELETE FROM questions WHERE id IN (${EXAMPLE_FILTER})`).run();
  db.exec("COMMIT");
  console.log(`🗑️ Preguntas de ejemplo borradas: ${questions.changes} (y ${answers.changes} respuestas a ellas)`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("❌ No se pudieron borrar las preguntas de ejemplo:", (err as Error).message);
  process.exit(1);
}

console.log(`📚 Total de preguntas en la base de datos: ${countQuestions()}`);
db.close();
