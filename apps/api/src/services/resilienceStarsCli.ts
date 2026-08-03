import { spawn } from 'node:child_process';

/**
 * Adaptateur vers le binaire `claude` (Claude Code CLI).
 *
 * On passe par le CLI et non par l'API HTTP afin de s'authentifier via
 * l'abonnement de l'utilisateur : AUCUNE cle API n'est requise ni stockee.
 * C'est ce qui permet au cron de tourner sans secret et sans provider tiers.
 */
export interface ClaudeCliOptions {
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export function resolveModel(model?: string): string {
  return model ?? process.env.RESILIENCE_STARS_MODEL ?? 'claude-sonnet-5';
}

/**
 * Envoie `prompt` sur stdin de `claude -p --output-format json` et renvoie le
 * texte de la reponse (champ `result` de l'enveloppe JSON du CLI).
 */
export async function runClaudeJson(prompt: string, options: ClaudeCliOptions = {}): Promise<string> {
  const binary = process.env.CLAUDE_BIN || 'claude';
  const model = resolveModel(options.model);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const args = ['-p', '--model', model, '--output-format', 'json'];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`claude: timeout apres ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on('data', chunk => { out = `${out}${chunk}`; });
    child.stderr.on('data', chunk => { err = `${err}${chunk}`.slice(-4000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude: code de sortie ${code}: ${err.trim()}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  let envelope: { is_error?: boolean; result?: unknown };
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new Error(`claude: enveloppe JSON illisible: ${stdout.slice(0, 300)}`);
  }
  if (envelope.is_error) throw new Error(`claude: erreur du modele: ${String(envelope.result ?? 'inconnue')}`);
  if (typeof envelope.result !== 'string') throw new Error('claude: champ result absent');
  return envelope.result;
}
