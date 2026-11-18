// Convierte un .fbx de Rokoko (esqueleto Mixamo) en el formato de golpe del juego:
// por fotograma, el giro de cada hueso respecto a su postura en T (en el espacio del personaje), la cadera y la altura del pie.
// Uso: await (await import(blobUrl)).convierte('/dev/remate_a.fbx', { quita: 3 })
import * as THREE from 'three';
const MAPA = { Hips: 'pelvis', Spine: 'spine_01', Spine1: 'spine_02', Spine2: 'spine_03', Neck: 'neck_01', Head: 'Head',
  LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r' };
export async function convierte(url, op = {}) {
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
  const o = new FBXLoader().parse(await (await fetch(url)).arrayBuffer(), '');
  o.updateMatrixWorld(true);
  const B = {}; o.traverse(x => { if (x.isBone) { const n = x.name.replace('mixamorig', ''); if (!B[n]) B[n] = x; } });
  const nombres = Object.keys(MAPA);
  const restQ = {}; for (const n of nombres) restQ[n] = B[n].getWorldQuaternion(new THREE.Quaternion());
  const wp = n => B[n].getWorldPosition(new THREE.Vector3());
  const restHips = wp('Hips').y;
  const clip = o.animations[0], fps = 30, nF = Math.round(clip.duration * fps) + 1;
  const mx = new THREE.AnimationMixer(o); mx.clipAction(clip).play();
  const raw = [];
  for (let f = op.quita || 0; f < nF; f++) {
    mx.setTime(f / fps); o.updateMatrixWorld(true);
    const d = nombres.map(n => B[n].getWorldQuaternion(new THREE.Quaternion()).multiply(restQ[n].clone().invert()));
    const sh = wp('LeftArm').sub(wp('RightArm')), fwd = sh.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();   // hacia donde mira
    raw.push({ d, hips: wp('Hips'), pie: Math.min(wp('LeftFoot').y, wp('RightFoot').y, wp('LeftToeBase').y + 4, wp('RightToeBase').y + 4), fwd, mano: wp('RightHand').y });
  }
  // de cara al frente (+z) en el impacto (cuando la mano de la pala está más alta, o en el fotograma op.impacto)
  let imp = op.impacto ?? raw.reduce((m, r, i) => r.mano > raw[m].mano ? i : m, 0);
  const yaw = Math.atan2(raw[imp].fwd.x, raw[imp].fwd.z), R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  // sin desplazamiento horizontal (el jugador lo mueve el juego): la cadera, respecto a su posición en el impacto
  const h0 = raw[imp].hips.clone();
  const r4 = x => Math.round(x * 1e4) / 1e4;
  return JSON.stringify({
    fps, huesos: nombres.map(n => MAPA[n]), impacto: imp, restCadera: r4(restHips / 100),
    // (el reposo sigue mirando a +z: girar la postura entera es girar el giro de cada hueso, R·Δ)
    q: raw.map(r => r.d.flatMap(q => { const k = R.clone().multiply(q); return [r4(k.x), r4(k.y), r4(k.z), r4(k.w)]; })),
    // cadera: por defecto en el sitio (el jugador lo mueve el juego); con op.conPasos, con lo que se mueve respecto al impacto
    cadera: raw.map(r => { const v = r.hips.clone().sub(h0).applyQuaternion(R).multiplyScalar(op.conPasos ? 0.01 : 0); return [r4(v.x), r4(r.hips.y / 100), r4(v.z)]; }),
    pie: raw.map(r => r4(r.pie / 100)),
  });
}
