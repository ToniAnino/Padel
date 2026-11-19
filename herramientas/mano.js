// Pruebas de la mano derecha del chico de Mixamo: fotos de cerca y puño cerrado sobre el mango
import * as THREE from 'three';

// cierra los dedos de la mano derecha en la postura de reposo (la malla enlazada); a todo lo que pesa en RightHand
// más allá de los nudillos lo enrolla alrededor de un cilindro (el mango) que queda bajo la palma
export function cierraMano(m, op = {}) {
  const sk = m.skeleton, nom = sk.bones.map(b => b.name.replace('mixamorig', ''));
  const iH = nom.indexOf('RightHand'), iF = nom.indexOf('RightForeArm');
  m.updateMatrixWorld(true);
  const W = sk.bones[iH].getWorldPosition(new THREE.Vector3()), F = sk.bones[iF].getWorldPosition(new THREE.Vector3());
  const a = W.clone().sub(F).normalize();                       // a lo largo de la mano (hacia los dedos)
  const abajo = new THREE.Vector3(0, -1, 0).addScaledVector(a, a.y).normalize();   // hacia la palma
  const lado = new THREE.Vector3().crossVectors(a, abajo).normalize();               // eje del mango
  const P = m.geometry.attributes.position, SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
  const inv = m.matrixWorld.clone().invert(), v = new THREE.Vector3();
  const u0 = op.nudillo ?? 9, R = op.radio ?? 2.4, palma = op.palma ?? 1.5;   // cm
  let n = 0;
  for (let i = 0; i < P.count; i++) {
    let w = 0; for (let j = 0; j < 4; j++) if (SI.getComponent(i, j) === iH) w += SW.getComponent(i, j);
    if (w < .5) continue;
    v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
    const d = v.clone().sub(W), u = d.dot(a), h = d.dot(abajo), s = d.dot(lado);
    if (u <= u0) continue;
    // centro del mango: a la altura del nudillo, bajo la palma
    const hc = palma + R;                     // distancia del eje del hueso al eje del mango, hacia la palma
    const rad = hc - h;                       // distancia del punto al eje del mango (los de encima, más lejos)
    const th = Math.min((u - u0) / Math.max(rad, R * .8), op.max ?? 3.6);
    const nu = u0 + rad * Math.sin(th), nh = hc - rad * Math.cos(th);
    const p = W.clone().addScaledVector(a, nu).addScaledVector(abajo, nh).addScaledVector(lado, s);
    p.applyMatrix4(inv); P.setXYZ(i, p.x, p.y, p.z); n++;
  }
  P.needsUpdate = true; m.geometry.computeBoundingSphere();
  return { n, W, a, abajo, lado };
}

// foto de la mano derecha desde varios lados (lienzo 1600x600) y la manda a /shot
export async function fotoMano(o, vistas = [[0, 0], [Math.PI / 2, 0], [0, -Math.PI / 2.2], [Math.PI, 0]]) {
  let m; o.traverse(x => { if (x.isSkinnedMesh) m = x; });
  const sk = m.skeleton, iH = sk.bones.findIndex(b => b.name.endsWith('RightHand'));
  const W = sk.bones[iH].getWorldPosition(new THREE.Vector3());
  const c = W.clone().add(new THREE.Vector3(-9, -2, 0));
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(1600, 600); r.setScissorTest(true);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x9aa4ad); sc.add(o);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2)); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 3, 2); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 400 / 600, 1, 2000);
  vistas.forEach(([az, el], i) => {
    const d = 75; cam.position.set(c.x + Math.sin(az) * Math.cos(el) * d, c.y - Math.sin(el) * d, c.z + Math.cos(az) * Math.cos(el) * d);
    cam.up.set(0, 1, 0); if (Math.abs(el) > 1.4) cam.up.set(0, 0, -1); cam.lookAt(c); cam.updateProjectionMatrix();
    r.setViewport(i * 400, 0, 400, 600); r.setScissor(i * 400, 0, 400, 600); r.render(sc, cam);
  });
  sc.remove(o);
  return (await fetch('/shot', { method: 'POST', body: r.domElement.toDataURL('image/jpeg', .85) })).status;
}
