import fs from 'fs';
import path from 'path';

const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN || '';
const FILE_KEY = 'akpo5W8c3ViA1hvjeqg9YJ';


const NODE_LIST = [
  // Mobile / Coleta
  { group: 'Mobile / Coleta', id: '13:2' },
  { group: 'Mobile / Coleta', id: '13:27' },
  { group: 'Mobile / Coleta', id: '13:48' },
  { group: 'Mobile / Coleta', id: '13:68' },
  { group: 'Mobile / Coleta', id: '13:87' },
  { group: 'Mobile / Coleta', id: '22:2' },
  { group: 'Mobile / Coleta', id: '22:22' },
  { group: 'Mobile / Coleta', id: '22:36' },
  { group: 'Mobile / Coleta', id: '22:52' },
  { group: 'Mobile / Coleta', id: '22:73' },
  { group: 'Mobile / Coleta', id: '22:89' },

  // Mobile / Operação
  { group: 'Mobile / Operação', id: '14:2' },
  { group: 'Mobile / Operação', id: '14:19' },
  { group: 'Mobile / Operação', id: '14:41' },
  { group: 'Mobile / Operação', id: '14:57' },
  { group: 'Mobile / Operação', id: '14:75' },
  { group: 'Mobile / Operação', id: '24:2' },
  { group: 'Mobile / Operação', id: '24:17' },
  { group: 'Mobile / Operação', id: '24:34' },
  { group: 'Mobile / Operação', id: '24:53' },
  { group: 'Mobile / Operação', id: '24:67' },

  // Consulta pública - QR
  { group: 'Consulta pública - QR', id: '15:93' },
  { group: 'Consulta pública - QR', id: '15:106' },

  // Acesso
  { group: 'Acesso', id: '27:3' },

  // Protótipo / Handoff
  { group: 'Protótipo navegável', id: '23:361' },
  { group: 'Estado de handoff', id: '8:12' }
];

function extractTexts(node) {
  let texts = [];
  if (!node) return texts;
  if (node.type === 'TEXT' && node.characters) {
    texts.push({
      text: node.characters.trim(),
      fontSize: node.style?.fontSize,
      fontWeight: node.style?.fontWeight,
      name: node.name
    });
  }
  if (node.children) {
    for (const child of node.children) {
      texts = texts.concat(extractTexts(child));
    }
  }
  return texts;
}

async function main() {
  const idsParam = encodeURIComponent(NODE_LIST.map(n => n.id).join(','));
  const nodesUrl = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${idsParam}`;
  
  const res = await fetch(nodesUrl, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });
  
  const data = await res.json();
  const summary = [];

  for (const item of NODE_LIST) {
    const rawNode = data.nodes[item.id];
    const doc = rawNode?.document;
    if (!doc) continue;

    const texts = extractTexts(doc);
    const imageFileName = `frame_${item.id.replace(':', '_')}.png`;

    summary.push({
      id: item.id,
      group: item.group,
      name: doc.name,
      width: doc.absoluteBoundingBox?.width,
      height: doc.absoluteBoundingBox?.height,
      image: `docs/design-system/figma-screenshots/${imageFileName}`,
      texts
    });
  }

  fs.writeFileSync(
    'docs/design-system/figma-parsed-frames.json',
    JSON.stringify(summary, null, 2)
  );

  console.log(`Parsed ${summary.length} frames successfully.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
