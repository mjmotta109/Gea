/**
 * Prototipo 3D (dirección de arte): la misma batalla del valle, renderizada
 * con Three.js en modo espectador — IA contra IA, cámara orbital libre.
 *
 * Objetivo: comparar en una misma escena el modelo GLB subido por el
 * usuario (Liger Zero) con unidades de primitivas low-poly, y validar el
 * estilo visual antes de comprometer el cliente jugable al 3D.
 *
 * Build: npm run web3d  →  dist/web/gea3d.html (autocontenido; el modelo
 * viaja embebido como data URI y el motor es el mismo de siempre).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// esbuild empaqueta el .glb como data URI (loader: dataurl).
// eslint-disable-next-line
// @ts-ignore
import ligerUrl from '../../assets/models/liger-zero.opt.glb';

import { planTurn } from '../ai/simpleAi.js';
import { Battle } from '../core/battle.js';
import type { BattleEvent, Facing, Position, UnitState } from '../core/types.js';
import { ABILITIES } from '../data/abilities.js';
import { VALLEY_CROSSING } from '../data/maps.js';
import { MODULES } from '../data/modules.js';
import { WEAPONS } from '../data/weapons.js';
import { ZOIDS } from '../data/zoids.js';

const $ = (id: string): HTMLElement => document.getElementById(id)!;

// ── Escena base ──────────────────────────────────────────────────────────

const TILE = 1;                       // lado de casilla en unidades de mundo
const HALF_LEVEL = 0.22;              // altura visual de cada medio nivel

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1014);
scene.fog = new THREE.Fog(0x0b1014, 18, 42);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
($('stage')).appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
camera.position.set(6, 9, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 4;
controls.maxDistance = 30;

const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x9fc3e8, 0x27331f, 0.9));

function resize(): void {
  const el = $('stage');
  const w = el.clientWidth;
  const h = el.clientHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ── Terreno ──────────────────────────────────────────────────────────────

const TERRAIN_COLOR: Record<string, number> = {
  plain: 0x3d5a43,
  rough: 0x6b5f41,
  water: 0x1e4a6d,
  forest: 0x2c5231,
  wall: 0x22262b,
};

let boardGroup = new THREE.Group();

function tileTop(pos: Position): THREE.Vector3 {
  const tile = VALLEY_CROSSING.tileAt(pos);
  const h = Math.min(tile.height, 6) * HALF_LEVEL + 0.3;
  return new THREE.Vector3(
    (pos.x - VALLEY_CROSSING.width / 2 + 0.5) * TILE,
    h,
    (pos.y - VALLEY_CROSSING.height / 2 + 0.5) * TILE,
  );
}

function buildBoard(): void {
  scene.remove(boardGroup);
  boardGroup = new THREE.Group();

  for (let y = 0; y < VALLEY_CROSSING.height; y++) {
    for (let x = 0; x < VALLEY_CROSSING.width; x++) {
      const tile = VALLEY_CROSSING.tileAt({ x, y });
      const top = tileTop({ x, y });
      const height = top.y;
      const isWater = tile.terrain === 'water';

      const geo = new THREE.BoxGeometry(TILE * 0.98, isWater ? height - 0.12 : height, TILE * 0.98);
      const mat = new THREE.MeshStandardMaterial({
        color: TERRAIN_COLOR[tile.terrain]!,
        roughness: isWater ? 0.25 : 0.95,
        metalness: isWater ? 0.35 : 0,
        transparent: isWater,
        opacity: isWater ? 0.85 : 1,
      });
      // Variación sutil por casilla para que el suelo no sea plano visualmente.
      mat.color.offsetHSL(0, 0, ((x * 7 + y * 13) % 5) * 0.008);
      const box = new THREE.Mesh(geo, mat);
      box.position.set(top.x, (isWater ? height - 0.12 : height) / 2, top.z);
      box.receiveShadow = true;
      box.castShadow = tile.height > 0;
      boardGroup.add(box);

      if (tile.terrain === 'forest') {
        // Un par de coníferas low-poly por casilla de bosque.
        for (const [ox, oz] of [[-0.22, -0.18], [0.2, 0.22]] as const) {
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.05, 0.18, 5),
            new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }),
          );
          trunk.position.set(top.x + ox, height + 0.09, top.z + oz);
          const crown = new THREE.Mesh(
            new THREE.ConeGeometry(0.16, 0.45, 6),
            new THREE.MeshStandardMaterial({ color: 0x1f6b33, roughness: 0.9 }),
          );
          crown.position.set(top.x + ox, height + 0.38, top.z + oz);
          trunk.castShadow = crown.castShadow = true;
          boardGroup.add(trunk, crown);
        }
      }
    }
  }
  scene.add(boardGroup);
}

// ── Unidades: el GLB del usuario + primitivas para el resto ─────────────

const FACING_ANGLE: Record<Facing, number> = {
  east: -Math.PI / 2, west: Math.PI / 2, north: Math.PI, south: 0,
};

const TEAM_TINT: Record<string, number> = { player: 0x53d1e0, enemy: 0xff8a5c };

let ligerTemplate: THREE.Object3D | null = null;

/** Primitivas low-poly con silueta por rol (comparación de estilo). */
function buildPrimitiveUnit(unitTypeId: string, team: string): THREE.Object3D {
  const group = new THREE.Group();
  const tint = new THREE.Color(TEAM_TINT[team]!);
  const body = new THREE.MeshStandardMaterial({ color: tint.clone().offsetHSL(0, -0.25, -0.12), roughness: 0.6, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.8, metalness: 0.3 });

  const add = (mesh: THREE.Mesh, x: number, y: number, z: number): THREE.Mesh => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  const torso = (w: number, h: number, d: number, y: number) =>
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), body), 0, y, 0);

  switch (unitTypeId) {
    case 'geno-saurer-cp': case 'geno-saurer': { // bípedo alto con cola
      torso(0.34, 0.42, 0.5, 0.52);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.34), body), 0, 0.82, -0.3); // cabeza
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), dark), 0, 0.6, 0.42);  // cola
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), dark), 0, 0.9, -0.1).rotation.x = Math.PI / 3; // cañón dorsal
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.16), dark), -0.14, 0.2, 0.05);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.16), dark), 0.14, 0.2, 0.05);
      break;
    }
    case 'pteras': { // volador con alas
      torso(0.2, 0.16, 0.5, 0.7);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.22), body), 0, 0.74, 0);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), dark), 0, 0.7, -0.32).rotation.x = -Math.PI / 2;
      break;
    }
    case 'molga': { // oruga baja y larga
      torso(0.3, 0.2, 0.6, 0.2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.62), dark), 0, 0.07, 0);
      break;
    }
    case 'gustav': { // caracol acorazado
      torso(0.36, 0.24, 0.5, 0.22);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), dark), 0, 0.42, 0.08);
      break;
    }
    case 'gun-sniper-naomi': case 'gun-sniper': { // raptor con rifle de cola
      torso(0.2, 0.26, 0.36, 0.42);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.24), body), 0, 0.62, -0.24);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), dark), 0, 0.62, 0.3).rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), dark), -0.1, 0.17, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.12), dark), 0.1, 0.17, 0);
      break;
    }
    default: { // cuadrúpedo genérico (command wolf...)
      torso(0.26, 0.24, 0.56, 0.4);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.2), body), 0, 0.56, -0.34);
      for (const [lx, lz] of [[-0.11, -0.18], [0.11, -0.18], [-0.11, 0.18], [0.11, 0.18]] as const) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.1), dark), lx, 0.15, lz);
      }
    }
  }

  // Baliza de equipo: anillo en la base.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.025, 8, 24),
    new THREE.MeshBasicMaterial({ color: TEAM_TINT[team]! }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  return group;
}

function buildLigerUnit(team: string): THREE.Object3D {
  const group = new THREE.Group();
  const model = ligerTemplate!.clone(true);

  // Normaliza el modelo al tamaño de una unidad de tablero.
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 0.95 / Math.max(size.x, size.z);
  model.scale.setScalar(scale);
  const scaled = new THREE.Box3().setFromObject(model);
  model.position.y -= scaled.min.y;
  model.position.x -= (scaled.min.x + scaled.max.x) / 2;
  model.position.z -= (scaled.min.z + scaled.max.z) / 2;
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  group.add(model);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({ color: TEAM_TINT[team]! }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);
  return group;
}

// ── Batalla en modo espectador ───────────────────────────────────────────

let battle: Battle;
const unitMeshes = new Map<string, THREE.Object3D>();
let effects: THREE.Object3D[] = [];
let timer: number | undefined;

function spawnUnits(): void {
  for (const mesh of unitMeshes.values()) scene.remove(mesh);
  unitMeshes.clear();

  for (const unit of battle.units) {
    const mesh = unit.unitTypeId === 'liger-zero-cas'
      ? buildLigerUnit(unit.team)
      : buildPrimitiveUnit(unit.unitTypeId, unit.team);
    const top = tileTop(unit.position);
    mesh.position.copy(top);
    if (unit.unitTypeId === 'pteras') mesh.position.y += 0.5;
    mesh.rotation.y = FACING_ANGLE[unit.facing];
    scene.add(mesh);
    unitMeshes.set(unit.id, mesh);
  }
}

function newBattle(): void {
  if (timer) window.clearTimeout(timer);
  const seed = Number(($('seed') as HTMLInputElement).value) || 42;
  battle = new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed,
    spawns: [
      { id: 'P1', name: 'Liger Zero CAS', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 1, y: 3 } },
      { id: 'P2', name: 'Command Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 5 } },
      { id: 'P3', name: 'Gun Sniper', unitTypeId: 'gun-sniper-naomi', team: 'player', position: { x: 1, y: 7 } },
      { id: 'P4', name: 'Gustav', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 4 } },
      { id: 'E1', name: 'Geno Saurer CP', unitTypeId: 'geno-saurer-cp', team: 'enemy', position: { x: 10, y: 3 } },
      { id: 'E2', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 11, y: 5 } },
      { id: 'E3', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 6 } },
      { id: 'E4', name: 'Pteras', unitTypeId: 'pteras', team: 'enemy', position: { x: 11, y: 2 } },
    ],
  });
  spawnUnits();
  setStatus('batalla en curso — IA vs IA');
  step();
}

/** Cola de animaciones visuales derivadas de los eventos del motor. */
interface VisualAnim {
  update(dt: number): boolean; // false = terminada
}
let anims: VisualAnim[] = [];

function animateMove(unitId: string, path: Position[], hover: number): void {
  const mesh = unitMeshes.get(unitId);
  if (!mesh) return;
  const points = path.map((p) => tileTop(p).add(new THREE.Vector3(0, hover, 0)));
  let t = 0;
  const perTile = 0.16;
  const total = perTile * (points.length - 1);
  anims.push({
    update(dt) {
      t += dt;
      const progress = Math.min(1, t / total);
      const idx = Math.min(points.length - 2, Math.floor(progress * (points.length - 1)));
      const local = progress * (points.length - 1) - idx;
      mesh.position.lerpVectors(points[idx]!, points[idx + 1]!, local);
      if (points[idx + 1]!.x !== points[idx]!.x || points[idx + 1]!.z !== points[idx]!.z) {
        mesh.rotation.y = Math.atan2(
          points[idx + 1]!.x - points[idx]!.x,
          points[idx + 1]!.z - points[idx]!.z,
        );
      }
      return progress < 1;
    },
  });
}

function tracer(from: Position, to: Position, color: number): void {
  const a = tileTop(from).add(new THREE.Vector3(0, 0.45, 0));
  const b = tileTop(to).add(new THREE.Vector3(0, 0.45, 0));
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
  scene.add(line);
  effects.push(line);
  let life = 0.35;
  anims.push({
    update(dt) {
      life -= dt;
      (line.material as THREE.LineBasicMaterial).opacity = Math.max(0, life / 0.35);
      if (life <= 0) { scene.remove(line); return false; }
      return true;
    },
  });
}

function burst(at: Position, color: number, count = 14): void {
  const origin = tileTop(at).add(new THREE.Vector3(0, 0.4, 0));
  const parts: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3 }> = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.copy(origin);
    scene.add(mesh);
    effects.push(mesh);
    parts.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3.2, (Math.random() - 0.5) * 3),
    });
  }
  let life = 0.7;
  anims.push({
    update(dt) {
      life -= dt;
      for (const p of parts) {
        p.vel.y -= 9 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.multiplyScalar(0.94);
      }
      if (life <= 0) { for (const p of parts) scene.remove(p.mesh); return false; }
      return true;
    },
  });
}

function applyEvents(events: BattleEvent[]): void {
  let attacker: UnitState | undefined;
  for (const event of events) {
    switch (event.type) {
      case 'unit-moved':
      case 'unit-boosted': {
        const unit = battle.unit(event.unitId);
        animateMove(event.unitId, event.path, unit.unitTypeId === 'pteras' ? 0.5 : 0);
        break;
      }
      case 'ability-used':
        attacker = battle.unit(event.unitId);
        break;
      case 'damage-dealt': {
        const target = battle.unit(event.targetUnitId);
        if (attacker) tracer(attacker.position, target.position, 0xffe27a);
        burst(target.position, 0xff8a5c);
        break;
      }
      case 'ability-missed': {
        const target = battle.unit(event.targetUnitId);
        if (attacker) tracer(attacker.position, target.position, 0x8598a8);
        break;
      }
      case 'unit-destroyed': {
        const mesh = unitMeshes.get(event.unitId);
        const unit = battle.unit(event.unitId);
        burst(unit.position, 0xff4a2a, 26);
        if (mesh) {
          let life = 0.6;
          anims.push({
            update(dt) {
              life -= dt;
              mesh.position.y -= dt * 0.6;
              mesh.rotation.z += dt * 1.2;
              if (life <= 0) { scene.remove(mesh); unitMeshes.delete(event.unitId); return false; }
              return true;
            },
          });
        }
        break;
      }
      case 'battle-ended':
        setStatus(`★ victoria del equipo ${event.winner === 'player' ? 'CIAN (jugador)' : 'NARANJA (enemigo)'} — cambia la semilla y relanza`);
        break;
      default:
        break;
    }
  }
}

/** Sincroniza posición/orientación de las fichas que no están animándose. */
function syncUnits(): void {
  if (!battle) return;
  for (const unit of battle.units) {
    const mesh = unitMeshes.get(unit.id);
    if (!mesh || unit.hp <= 0) continue;
    const target = tileTop(unit.position);
    if (unit.unitTypeId === 'pteras') target.y += 0.5;
    if (mesh.position.distanceTo(target) < 0.01) {
      mesh.rotation.y = FACING_ANGLE[unit.facing];
    }
  }
}

function step(): void {
  if (battle.isOver) return;
  if (!battle.getActiveUnit()) applyEvents(battle.nextTurn());
  const active = battle.getActiveUnit();
  if (!active || battle.isOver) return;

  const actions = planTurn(battle, active);
  let i = 0;
  const exec = (): void => {
    if (battle.isOver || i >= actions.length) {
      timer = window.setTimeout(step, 240);
      return;
    }
    try {
      applyEvents(battle.execute(actions[i]!));
    } catch {
      if (battle.getActiveUnit()?.id === active.id) {
        applyEvents(battle.execute({ type: 'wait', unitId: active.id }));
      }
      i = actions.length;
    }
    i++;
    timer = window.setTimeout(exec, 420);
  };
  exec();
}

function setStatus(text: string): void {
  $('status').textContent = text;
}

// ── Bucle de render ──────────────────────────────────────────────────────

const clock = new THREE.Clock();
function loop(): void {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  anims = anims.filter((a) => a.update(dt));
  syncUnits();
  controls.update();
  renderer.render(scene, camera);
}

// ── Arranque ─────────────────────────────────────────────────────────────

/**
 * El modelo viaja embebido como data URI, pero el CSP de la página puede
 * bloquear fetch() incluso para data:. Se decodifica a mano y se usa
 * loader.parse(), que no toca la red.
 */
function dataUriToArrayBuffer(uri: string): ArrayBuffer {
  const base64 = uri.slice(uri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
setStatus('cargando modelo del Liger Zero...');
loader.parse(dataUriToArrayBuffer(ligerUrl as string), '', (gltf) => {
  ligerTemplate = gltf.scene;
  buildBoard();
  resize();
  newBattle();
  loop();
  $('restart').addEventListener('click', newBattle);
}, (error) => {
  setStatus(`error cargando el modelo: ${String(error)}`);
});
