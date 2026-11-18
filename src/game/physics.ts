import * as THREE from 'three';

// Física propia, sencilla y predecible: todo el mundo está hecho de cajas (AABB).
// Más ligera que un motor de física completo y perfecta para un mundo de bloques.

export type SolidKind = 'normal' | 'bounce' | 'checkpoint' | 'finish';

export interface MoveSpec {
  axis: 'x' | 'y' | 'z';
  amp: number;
  speed: number;
  phase?: number;
}

export interface PlatformSpec {
  p: [number, number, number]; // centro
  s: [number, number, number]; // tamaño
  color: string;
  kind?: SolidKind;
  move?: MoveSpec;
  index?: number; // número de checkpoint
}

export interface Solid {
  spec: PlatformSpec;
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  base: THREE.Vector3;
  half: THREE.Vector3;
  delta: THREE.Vector3;
  kind: SolidKind;
  obj: THREE.Object3D | null;
  squash: number; // animación de trampolín
}

export function makeSolids(specs: PlatformSpec[]): Solid[] {
  return specs.map((spec) => {
    const center = new THREE.Vector3(...spec.p);
    const half = new THREE.Vector3(spec.s[0] / 2, spec.s[1] / 2, spec.s[2] / 2);
    return {
      spec,
      center,
      base: center.clone(),
      half,
      min: center.clone().sub(half),
      max: center.clone().add(half),
      delta: new THREE.Vector3(),
      kind: spec.kind ?? 'normal',
      obj: null,
      squash: 0,
    };
  });
}

export function updateMovers(solids: Solid[], t: number) {
  for (const s of solids) {
    const m = s.spec.move;
    if (!m) continue;
    const prev = s.center.clone();
    s.center.copy(s.base);
    s.center[m.axis] += Math.sin(t * m.speed + (m.phase ?? 0)) * m.amp;
    s.delta.subVectors(s.center, prev);
    s.min.copy(s.center).sub(s.half);
    s.max.copy(s.center).add(s.half);
    if (s.obj) s.obj.position.copy(s.center);
  }
}

export const HALF = 0.36;
export const HEIGHT = 2.2;
const SPEED = 7.5;
const JUMP = 11.5;
const GRAVITY = 30;
const BOUNCE = 19;

export interface StepEvents {
  jumped: boolean;
  bounced: boolean;
  landedOn: Solid | null;
}

export class Controller {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  grounded = false;
  ground: Solid | null = null;
  coyote = 0;
  jumpBuffer = 0;
  facing = 0;

  reset(p: THREE.Vector3, facing = 0) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.grounded = false;
    this.ground = null;
    this.facing = facing;
  }

  step(dt: number, wishX: number, wishZ: number, jump: boolean, solids: Solid[]): StepEvents {
    const ev: StepEvents = { jumped: false, bounced: false, landedOn: null };

    // la plataforma en la que estoy parado me lleva con ella
    if (this.ground) this.pos.add(this.ground.delta);

    const accel = this.grounded ? 16 : 7;
    const f = 1 - Math.exp(-accel * dt);
    this.vel.x += (wishX * SPEED - this.vel.x) * f;
    this.vel.z += (wishZ * SPEED - this.vel.z) * f;

    if (jump) this.jumpBuffer = 0.15;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? 0.13 : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vel.y = JUMP;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.ground = null;
      ev.jumped = true;
    }

    this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -45);

    // mover por eje y resolver choques
    const wasGrounded = this.grounded;
    this.pos.x += this.vel.x * dt;
    this.resolveH('x', solids);
    this.pos.z += this.vel.z * dt;
    this.resolveH('z', solids);

    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    this.grounded = false;
    this.ground = null;
    for (const s of solids) {
      if (!this.overlaps(s)) continue;
      if (prevY >= s.max.y - 0.25 - Math.max(0, -this.vel.y * dt)) {
        // aterrizar arriba
        this.pos.y = s.max.y;
        if (s.kind === 'bounce') {
          this.vel.y = BOUNCE;
          s.squash = 1;
          ev.bounced = true;
        } else {
          this.vel.y = 0;
          this.grounded = true;
          this.ground = s;
          if (!wasGrounded) ev.landedOn = s;
        }
      } else if (this.vel.y > 0) {
        // pegar con la cabeza
        this.pos.y = s.min.y - HEIGHT;
        this.vel.y = 0;
      }
    }
    if (this.grounded && wasGrounded === false && !ev.landedOn) ev.landedOn = this.ground;

    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.5) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-14 * dt));
    }
    return ev;
  }

  get speed01() {
    return Math.min(1, Math.hypot(this.vel.x, this.vel.z) / SPEED);
  }

  private overlaps(s: Solid) {
    const p = this.pos;
    return (
      p.x + HALF > s.min.x && p.x - HALF < s.max.x &&
      p.z + HALF > s.min.z && p.z - HALF < s.max.z &&
      p.y + HEIGHT > s.min.y && p.y < s.max.y - 0.001
    );
  }

  private resolveH(axis: 'x' | 'z', solids: Solid[]) {
    const v = this.vel[axis];
    for (const s of solids) {
      if (!this.overlaps(s)) continue;
      // si casi estoy arriba de la caja, súbeme (escalón pequeño)
      if (this.pos.y >= s.max.y - 0.6 && this.vel.y <= 0) {
        this.pos.y = s.max.y;
        continue;
      }
      if (v > 0) this.pos[axis] = s.min[axis] - HALF - 0.001;
      else if (v < 0) this.pos[axis] = s.max[axis] + HALF + 0.001;
      else {
        // me empujó una plataforma: salir por el lado más cercano
        const c = s.center[axis];
        this.pos[axis] = this.pos[axis] < c ? s.min[axis] - HALF - 0.001 : s.max[axis] + HALF + 0.001;
      }
      this.vel[axis] = 0;
    }
  }
}
