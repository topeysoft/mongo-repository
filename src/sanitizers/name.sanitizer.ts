export function sanitizeModelName(name: string) {
    name=name||'';
  var  clean = name.replace(/[^\w]/gi, '_')||'';
  return clean.toLowerCase();
}