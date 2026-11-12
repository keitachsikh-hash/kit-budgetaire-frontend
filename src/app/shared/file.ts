/** Déclenche le téléchargement d'un fichier dans le navigateur. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

/** Lit un fichier JSON choisi par l'utilisateur. */
export function readJsonFile<T>(file: File): Promise<T> {
  return file.text().then(text => JSON.parse(text) as T);
}
