// FBX de Mixamo (chico o chica) -> glTF en .json con el formato del juego (como hombre.json):
// huesos con los nombres del modelo del juego, en metros, con hueso 'root', la mano derecha cerrada y normales suaves.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';

const MAPA = { Hips: 'pelvis', Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', Neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
  HeadTop_End: 'head_end', LeftToe_End: 'toe_end_l', RightToe_End: 'toe_end_r' };

export async function construye(url, cierraMano, opMano, nombre = 'chico') {
  const o = new FBXLoader().parse(await (await fetch(url, { cache: 'no-store' })).arrayBuffer(), '');
  o.updateMatrixWorld(true);
  let m; o.traverse(x => { if (x.isSkinnedMesh) m = x; });
  // 1. la mano derecha, cerrada (en cm, con el esqueleto de Mixamo aún)
  const mano = cierraMano(m, opMano);
  // 2. vértices compartidos y normales suaves
  let g = m.geometry;
  for (const n of Object.keys(g.attributes)) if (!['position', 'uv', 'skinIndex', 'skinWeight'].includes(n)) g.deleteAttribute(n);
  g = BGU.mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  // 3. a metros
  g.scale(.01, .01, .01);
  o.traverse(x => { if (x.isBone) x.position.multiplyScalar(.01); });
  // 4. nombres del juego y hueso 'root' en el origen (padre de la pelvis)
  o.traverse(x => { if (x.isBone) { const n = x.name.replace('mixamorig', ''); x.name = MAPA[n] || n; } });
  const pelvis = o.getObjectByName('pelvis');
  const root = new THREE.Bone(); root.name = 'root';
  o.add(root); root.add(pelvis);
  const viejos = m.skeleton.bones, huesos = [root, ...viejos];
  const si = g.attributes.skinIndex;
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, si.getComponent(i, k) + 1);
  // 5. malla nueva enlazada al esqueleto en la postura en T
  const mat = new THREE.MeshStandardMaterial({ name: nombre[0].toUpperCase() + nombre.slice(1), roughness: .8, metalness: 0 });
  const nm = new THREE.SkinnedMesh(g, mat); nm.name = nombre;
  o.remove(m); o.add(nm);
  o.updateMatrixWorld(true);
  nm.bind(new THREE.Skeleton(huesos), nm.matrixWorld);
  o.name = nombre;
  const json = await new GLTFExporter().parseAsync(o, { binary: false, onlyVisible: false });
  return { json, mano, verts: g.attributes.position.count, huesos: huesos.map(b => b.name) };
}
