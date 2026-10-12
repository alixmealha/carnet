// Petit rendu Markdown pour les textes du plan : paragraphes, listes, tableaux, **gras**, [liens](https://…), ### titres.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function inline(s) {
  let h = esc(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return h;
}
export function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^###\s/.test(l)) { out += '<h4>' + inline(l.replace(/^###\s/, '')) + '</h4>'; i++; continue; }
    if (/^\s*-\s/.test(l)) {
      out += '<ul>';
      while (i < lines.length && /^\s*-\s/.test(lines[i])) { out += '<li>' + inline(lines[i].replace(/^\s*-\s/, '')) + '</li>'; i++; }
      out += '</ul>'; continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i++; }
      const body = rows.filter((r, j) => !(j === 1 && r.every(c => /^:?-+:?$/.test(c))));
      const [head, ...rest] = body;
      out += '<div class="tw"><table class="t"><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rest.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*[-|]/.test(lines[i]) && !/^###\s/.test(lines[i])) { para.push(lines[i]); i++; }
    out += '<p>' + inline(para.join(' ')) + '</p>';
  }
  return out;
}
