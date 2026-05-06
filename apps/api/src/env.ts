/**
 * Side-effect module : doit être importé en TOUT PREMIER pour charger
 * les variables d'environnement avant tout autre import qui les lit.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });
