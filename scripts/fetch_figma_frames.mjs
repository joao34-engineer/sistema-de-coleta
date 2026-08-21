import fs from 'fs';
import path from 'path';

const FIGMA_TOKEN = process.env.FIGMA_PERSONAL_ACCESS_TOKEN || '';
const FILE_KEY = 'akpo5W8c3ViA1hvjeqg9YJ';


const NODE_GROUPS = {
  mobile_coleta: [
    '13:2', '13:27', '13:48', '13:68', '13:87',
    '22:2', '22:22', '22:36', '22:52', '22:73', '22:89'
  ],
  mobile_operacao: [
    '14:2', '14:19', '14:41', '14:57', '14:75',
    '24:2', '24:17', '24:34', '24:53', '24:67'
  ],
  consulta_publica_qr: [
    '15:93', '15:106'
  ],
  acesso: [
    '27:3'
  ],
  prototipo_navegavel: [
    '23:361'
  ],
  handoff: [
    '8:12'
  ]
};

const allNodeIds = Object.values(NODE_GROUPS).flat();

async function main() {
  console.log(`Buscando dados de ${allNodeIds.length} nós no Figma API...`);
  
  // 1. Fetch Node Metadata
  const idsParam = encodeURIComponent(allNodeIds.join(','));
  const nodesUrl = `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${idsParam}`;
  
  const nodesRes = await fetch(nodesUrl, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });
  
  if (!nodesRes.ok) {
    throw new Error(`Erro ao buscar nós: ${nodesRes.status} ${nodesRes.statusText}`);
  }
  
  const nodesData = await nodesRes.json();
  console.log('Metadados obtidos com sucesso!');

  // 2. Fetch Node Render Images (PNG @ 2x)
  const imagesUrl = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${idsParam}&format=png&scale=2`;
  const imagesRes = await fetch(imagesUrl, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });
  
  let imagesData = { images: {} };
  if (imagesRes.ok) {
    imagesData = await imagesRes.json();
    console.log('URLs de renderização de imagens obtidas com sucesso!');
  } else {
    console.warn('Aviso: Não foi possível obter URLs de imagens:', imagesRes.status);
  }

  // Ensure output directory for images
  const imgDir = path.resolve('docs/design-system/figma-screenshots');
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  const mappingResult = [];

  for (const [groupName, ids] of Object.entries(NODE_GROUPS)) {
    for (const id of ids) {
      const nodeInfo = nodesData.nodes[id];
      const doc = nodeInfo?.document;
      const imageUrl = imagesData.images[id];
      
      let localImagePath = null;
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const filename = `frame_${id.replace(':', '_')}.png`;
            localImagePath = path.join(imgDir, filename);
            fs.writeFileSync(localImagePath, Buffer.from(arrayBuffer));
            console.log(`Imagem salva: ${filename}`);
          }
        } catch (e) {
          console.error(`Erro ao salvar imagem para ${id}:`, e.message);
        }
      }

      mappingResult.push({
        group: groupName,
        id,
        name: doc?.name || 'Desconhecido',
        type: doc?.type || 'UNKNOWN',
        bbox: doc?.absoluteBoundingBox || null,
        childrenCount: doc?.children?.length || 0,
        imageUrl: imageUrl || null,
        localImage: localImagePath ? path.relative(process.cwd(), localImagePath) : null
      });
    }
  }

  // Save complete JSON analysis
  fs.writeFileSync(
    path.resolve('docs/design-system/figma-nodes-mapping.json'),
    JSON.stringify({ mappingResult, rawNodes: nodesData }, null, 2)
  );

  console.log('\nMapeamento finalizado e salvo em docs/design-system/figma-nodes-mapping.json');
}

main().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
