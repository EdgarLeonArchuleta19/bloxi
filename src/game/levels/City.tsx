import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../data/items';
import { input } from '../../lib/input';
import { sfx } from '../../lib/sound';
import { useGame } from '../../store';
import { Avatar, makeAnim, type AvatarAnim } from '../../three/Avatar';
import { Bursts, Cloud, burst } from '../fx';
import type { Solid } from '../physics';
import { PlayWorld, type Engine, type LevelHooks, type ThumbShot } from '../PlayWorld';
import { setActionHandler, setActions, useRun, type RunAction } from '../runStore';
import { CITY_HALF, CITY_SPAWN, SHOPS, TREES, VEHICLES, buildCity, type ShopId, type VehicleSpec } from './cityData';
import { CarModel, HouseDecor, MotoModel, ParkDecor, Roads, ShopsDecor, Signs, TreeTops, Windows } from './cityModels';
import { NAMES, nameTag, randomAvatar } from './colorBots';
import { Coins, type CoinData } from './pickups';

// 🏙️ Mini Ciudad: mundo abierto con casita, tiendas, carros, motos y bots que pueden ser tus amigos.

const PHRASES = [
  '¡Qué bonito día! ☀️',
  '¿Vamos por un helado? 🍦',
  '¡Me encantan los dinosaurios! 🦖',
  '¡Te echo carreritas! 🏃',
  '¿Sabías que los pulpos tienen 3 corazones? 🐙',
  '¡Tu ropa está increíble! ✨',
  '¡Vamos a la fuente! ⛲',
  '¡Me gusta tu peinado! 💇',
  'Hoy comí pizza 🍕 ¡mmm!',
  '¡Súbete a la moto! 🏍️',
];
const FRIEND_PHRASES = ['¡Sí! ¡Ahora somos amigos! 💖', '¡Yupi! ¡Amigos para siempre! 🌈', '¡Te voy a seguir a todos lados! 😄'];
const PRICES: Partial<Record<ShopId, number>> = { icecream: 3, pizza: 3, balloons: 2, fountain: 1 };
const MAX_FRIENDS = 6;

interface Npc {
  name: string;
  cfg: AvatarConfig;
  anim: AvatarAnim;
  pos: THREE.Vector3;
  goal: THREE.Vector3 | null;
  wait: number;
  facing: number;
  friend: boolean;
  slot: number;
  bubble: string | null;
  bubbleT: number;
  holdT: number;
  hidden: boolean;
}

interface Vehicle {
  spec: VehicleSpec;
  pos: THREE.Vector3;
  heading: number;
  v: number;
  lean: number;
}

/* ---------- burbujas de diálogo ---------- */
const bubbleCache = new Map<string, THREE.SpriteMaterial>();
function bubbleMat(text: string) {
  let m = bubbleCache.get(text);
  if (m) return m;
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 150;
  const c = cv.getContext('2d')!;
  c.font = 'bold 44px Fredoka, ui-rounded, system-ui, sans-serif';
  const w = Math.min(620, c.measureText(text).width + 60);
  const x = (640 - w) / 2;
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#33264d';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(x, 8, w, 100, 40);
  c.moveTo(300, 106);
  c.lineTo(320, 140);
  c.lineTo(342, 106);
  c.fill();
  c.stroke();
  c.fillStyle = '#ffffff';
  c.fillRect(302, 100, 38, 8);
  c.fillStyle = '#33264d';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 320, 60, w - 30);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, sizeAttenuation: false });
  bubbleCache.set(text, m);
  return m;
}

export function CityLevel({ avatar, thumb }: { avatar: AvatarConfig; thumb?: ThumbShot }) {
  const playerName = useGame((s) => s.name);
  const { platforms, apartments } = useMemo(buildCity, []);
  // copas de los árboles: la cámara no se mete en ellas
  const canopies = useMemo(
    () => TREES.map(([x, z]) => ({ min: new THREE.Vector3(x - 1.6, 1.8, z - 1.6), max: new THREE.Vector3(x + 1.6, 5, z + 1.6) })),
    [],
  );
  const engine = useRef<Engine | null>(null);
  const spawn = useMemo(() => new THREE.Vector3(...CITY_SPAWN), []);
  const solids = (): Solid[] => engine.current?.solids ?? [];

  /** ¿Choca un círculo con algo sólido? (edificios, troncos, bardas) */
  const hits = (x: number, z: number, r: number) => {
    const list = solids();
    for (let i = 1; i < list.length; i++) {
      const s = list[i];
      if (s.max.y < 0.4) continue;
      const dx = Math.max(s.min.x - x, 0, x - s.max.x);
      const dz = Math.max(s.min.z - z, 0, z - s.max.z);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };
  const groundAt = (x: number, z: number) => {
    let top = 0;
    const list = solids();
    for (let i = 1; i < list.length; i++) {
      const s = list[i];
      if (s.max.y > 1.2 || s.spec.hidden) continue; // solo cosas bajitas (fuente, kiosko)
      if (x > s.min.x && x < s.max.x && z > s.min.z && z < s.max.z) top = Math.max(top, s.max.y);
    }
    return top;
  };
  const randomSpot = (near?: THREE.Vector3, radius = 26): THREE.Vector3 => {
    for (let k = 0; k < 40; k++) {
      const x = near ? near.x + (Math.random() - 0.5) * radius * 2 : (Math.random() - 0.5) * (CITY_HALF * 2 - 10);
      const z = near ? near.z + (Math.random() - 0.5) * radius * 2 : (Math.random() - 0.5) * (CITY_HALF * 2 - 10);
      if (Math.abs(x) > CITY_HALF - 4 || Math.abs(z) > CITY_HALF - 4) continue;
      if (engine.current && hits(x, z, 1.4)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(CITY_SPAWN[0], 0, CITY_SPAWN[2]);
  };

  // 🚗 carros y motos
  const vehicles = useMemo<Vehicle[]>(
    () => VEHICLES.map((spec) => ({ spec, pos: new THREE.Vector3(spec.pos[0], 0, spec.pos[1]), heading: spec.heading, v: 0, lean: 0 })),
    [],
  );
  const vehRefs = useRef<(THREE.Group | null)[]>([]);
  const driving = useRef(-1);

  // 🧒 bots de la ciudad (+ amigos guardados)
  const npcs = useMemo<Npc[]>(() => {
    const saved = useGame.getState().cityFriends;
    const used = new Set(saved.map((f) => f.name));
    const make = (name: string, cfg: AvatarConfig, friend: boolean, pos: THREE.Vector3, slot = 0): Npc => ({
      name, cfg, anim: makeAnim(), pos, goal: null, wait: Math.random() * 2, facing: Math.random() * 6, friend, slot,
      bubble: null, bubbleT: 0, holdT: 0, hidden: false,
    });
    const list: Npc[] = saved.map((f, i) =>
      make(f.name, f.avatar, true, new THREE.Vector3(CITY_SPAWN[0] + (i % 3) * 1.6 - 1.6, 0, CITY_SPAWN[2] - 1.5 - Math.floor(i / 3) * 1.6), i),
    );
    const names = NAMES.filter((n) => !used.has(n)).sort(() => Math.random() - 0.5);
    const starts: [number, number][] = [[-12, -8], [8, -12], [14, 10], [-20, 10], [-6, 30], [30, -30], [6, 40], [-40, -6]];
    for (let i = 0; i < 8; i++) list.push(make(names[i], randomAvatar(), false, new THREE.Vector3(starts[i][0], 0, starts[i][1])));
    if (thumb)
      list.forEach((n, i) => {
        n.pos.set(thumb.player[0] + (i % 2 ? 2.4 : -2.4) + (i > 1 ? (i % 2 ? 1.5 : -1.5) : 0), 0, thumb.player[2] - 1 - (i > 1 ? 2.2 : 0));
        n.facing = Math.atan2(thumb.cam[0] - n.pos.x, thumb.cam[2] - n.pos.z);
        n.anim.cheer = i < 4 ? 999 : 0;
        n.wait = 999;
        if (i === 0) n.anim.hold = 'icecream';
        if (i === 1) n.anim.hold = 'balloon';
      });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const friendCount = () => npcs.filter((n) => n.friend).length;

  // 🪙 monedas por la ciudad
  const coins = useMemo<CoinData[]>(() => Array.from({ length: 28 }, () => ({ pos: new THREE.Vector3(), taken: true, t: 1 })), []);
  const coinTimers = useRef<number[]>(coins.map((_, i) => 0.5 + i * 0.05));

  const holdT = useRef(0);
  const actAcc = useRef(0);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__city = { engine, vehicles, npcs, driving };

  const say = (n: Npc, text: string, secs = 3.5) => {
    n.bubble = text;
    n.bubbleT = secs;
  };

  /* ---------- Acciones (botones) ---------- */
  const pay = (price: number) => {
    if (useGame.getState().coins < price) {
      sfx.error();
      useRun.getState().showToast('🥺 Te faltan monedas. ¡Busca ⭐ por la ciudad!');
      return false;
    }
    useGame.getState().addCoins(-price);
    sfx.buy();
    return true;
  };

  const giveTreat = (hold: string, secs: number) => {
    const e = engine.current;
    if (!e) return;
    e.anim.hold = hold;
    holdT.current = secs;
    e.anim.cheer = 1;
    // tus amigos cerca también reciben uno 💖
    npcs.forEach((n) => {
      if (n.friend && n.pos.distanceTo(e.ctrl.pos) < 10) {
        n.anim.hold = hold;
        n.holdT = secs;
        say(n, '¡Gracias! 😋', 2.5);
      }
    });
  };

  const startDriving = (i: number) => {
    const e = engine.current;
    if (!e) return;
    driving.current = i;
    e.anim.sit = true;
    e.anim.hold = undefined;
    sfx.engine();
    useRun.getState().showToast(vehicles[i].spec.kind === 'car' ? '🚗 ¡A manejar! Usa el joystick' : '🏍️ ¡Agárrate fuerte!');
  };

  const stopDriving = () => {
    const e = engine.current;
    const i = driving.current;
    if (!e || i < 0) return;
    const veh = vehicles[i];
    veh.v = 0;
    driving.current = -1;
    e.anim.sit = false;
    e.followYaw = null;
    e.cam.dist = 9;
    // bajarse por un lado (el que esté libre)
    const h = veh.heading;
    for (const side of [1, -1]) {
      const x = veh.pos.x + Math.cos(h) * 2.2 * side;
      const z = veh.pos.z - Math.sin(h) * 2.2 * side;
      if (!hits(x, z, 0.5)) {
        e.ctrl.reset(new THREE.Vector3(x, 0, z), h);
        break;
      }
    }
    // los amigos aparecen junto a ti
    npcs.forEach((n, k) => {
      if (!n.friend) return;
      n.hidden = false;
      n.pos.set(e.ctrl.pos.x + Math.cos(k) * 1.8, 0, e.ctrl.pos.z + Math.sin(k) * 1.8);
    });
  };

  useEffect(() => {
    if (thumb) return;
    setActionHandler((id) => {
      const e = engine.current;
      if (!e) return;
      const run = useRun.getState();
      if (id.startsWith('veh:')) return startDriving(Number(id.slice(4)));
      if (id === 'exit') return stopDriving();
      if (id === 'horn') {
        sfx.horn();
        npcs.forEach((n) => {
          if (!n.hidden && n.pos.distanceTo(e.ctrl.pos) < 14) {
            n.anim.wave = 1.2;
            say(n, n.friend ? '¡Ahí voy! 🏃' : '¡Hola! 👋', 2);
          }
        });
        return;
      }
      if (id.startsWith('hi:')) {
        const n = npcs[Number(id.slice(3))];
        sfx.hello();
        n.anim.wave = 1.6;
        e.anim.wave = 1.6;
        n.facing = Math.atan2(e.ctrl.pos.x - n.pos.x, e.ctrl.pos.z - n.pos.z);
        n.wait = 2.5;
        n.goal = null;
        const p = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        say(n, Math.random() < 0.3 ? `¡Hola, ${playerName}! 😄` : p);
        return;
      }
      if (id.startsWith('friend:')) {
        const n = npcs[Number(id.slice(7))];
        n.friend = true;
        n.slot = friendCount() - 1;
        n.anim.cheer = 1.5;
        e.anim.cheer = 1.5;
        sfx.star();
        burst(n.pos.clone().setY(2.2), '#ff7ab6', 26);
        say(n, FRIEND_PHRASES[Math.floor(Math.random() * FRIEND_PHRASES.length)]);
        useGame.getState().addCityFriend({ name: n.name, avatar: n.cfg });
        run.set({ friends: friendCount() });
        run.showToast(`💖 ¡${n.name} ahora es tu amigo!`);
        return;
      }
      if (id.startsWith('shop:')) {
        const shop = id.slice(5) as ShopId;
        const price = PRICES[shop] ?? 0;
        if (price && !pay(price)) return;
        switch (shop) {
          case 'icecream':
            giveTreat('icecream', 25);
            run.showToast('🍦 ¡Mmm, helado de fresa y mora!');
            break;
          case 'pizza':
            giveTreat('pizza', 20);
            run.showToast('🍕 ¡Pizza calientita!');
            break;
          case 'balloons':
            giveTreat('balloon', 40);
            run.showToast('🎈 ¡Un globo para ti!');
            break;
          case 'fountain': {
            sfx.star();
            burst(new THREE.Vector3(-18, 3, 18), '#ff7ab6', 40);
            const wishes = ['✨ ¡Deseo concedido! Hoy será un gran día', '🌈 ¡Tu deseo se va a cumplir!', '⭐ ¡La fuente dice que sí!', '🦄 ¡Pediste algo mágico!'];
            run.showToast(wishes[Math.floor(Math.random() * wishes.length)]);
            e.anim.cheer = 1.5;
            break;
          }
          case 'house':
            run.set({ banner: { name: '', color: '#33264d', text: '😴 Zzz… tomando una siesta' } });
            setTimeout(() => {
              useRun.getState().set({ banner: null });
              useRun.getState().showToast('☀️ ¡Qué buena siesta! Tus amigos te esperaban');
              const pe = engine.current;
              if (pe) pe.anim.cheer = 1.5;
              npcs.forEach((n, k) => {
                if (!n.friend || !pe) return;
                n.pos.set(pe.ctrl.pos.x + Math.cos(k * 1.3) * 2.2, 0, pe.ctrl.pos.z + 1.5 + Math.sin(k * 1.3));
                n.anim.cheer = 1.2;
              });
            }, 2200);
            break;
          case 'clothes':
            run.set({ overlay: 'closet', status: 'paused' });
            break;
        }
      }
    });
    return () => setActionHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Botones según dónde estés ---------- */
  const updateActions = () => {
    const e = engine.current;
    if (!e) return;
    if (driving.current >= 0) {
      setActions([
        { id: 'exit', label: '🚪 Bajarme', tone: 'white' },
        { id: 'horn', label: '📯 ¡Pip pip!', tone: 'sun' },
      ]);
      return;
    }
    const p = e.ctrl.pos;
    const opts: (RunAction & { d: number })[] = [];
    vehicles.forEach((v, i) => {
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (d < 3.4) opts.push({ id: `veh:${i}`, label: v.spec.kind === 'car' ? '🚗 Manejar' : '🏍️ Subir a la moto', tone: 'sky', d });
    });
    for (const s of SHOPS) {
      const d = Math.hypot(s.spot[0] - p.x, s.spot[1] - p.z);
      if (d > 3.6) continue;
      const price = PRICES[s.id];
      const label =
        s.id === 'house' ? '😴 Tomar una siesta' :
        s.id === 'clothes' ? '👗 Probarme ropa' :
        s.id === 'icecream' ? `🍦 Helado · ${price}🪙` :
        s.id === 'pizza' ? `🍕 Pizza · ${price}🪙` :
        s.id === 'balloons' ? `🎈 Globo · ${price}🪙` :
        `🪙 Pedir un deseo · ${price}🪙`;
      opts.push({ id: `shop:${s.id}`, label, tone: 'grape', d });
    }
    let nearest = -1, nd = 3.2;
    npcs.forEach((n, i) => {
      if (n.hidden) return;
      const d = n.pos.distanceTo(p);
      if (d < nd) {
        nd = d;
        nearest = i;
      }
    });
    if (nearest >= 0) {
      const n = npcs[nearest];
      opts.push({ id: `hi:${nearest}`, label: `👋 Saludar a ${n.name}`, tone: 'mint', d: nd });
      if (!n.friend && friendCount() < MAX_FRIENDS) opts.push({ id: `friend:${nearest}`, label: '💖 Ser amigos', tone: 'candy', d: nd + 0.01 });
    }
    opts.sort((a, b) => a.d - b.d);
    setActions(opts.slice(0, 2).map(({ id, label, tone }) => ({ id, label, tone })));
  };

  /* ---------- Bots: pasear y seguirte ---------- */
  const updateNpcs = (dt: number, e: Engine) => {
    const p = e.ctrl.pos;
    const isDriving = driving.current >= 0;
    let fi = 0;
    for (const n of npcs) {
      if (n.bubbleT > 0) {
        n.bubbleT -= dt;
        if (n.bubbleT <= 0) n.bubble = null;
      }
      if (n.holdT > 0) {
        n.holdT -= dt;
        if (n.holdT <= 0) n.anim.hold = undefined;
      }
      let target: THREE.Vector3 | null = null;
      let speed = 2.2;
      if (n.friend) {
        n.hidden = isDriving; // van "dentro" del carro
        if (isDriving) continue;
        // atrás de ti, en fila
        const back = 2.2 + Math.floor(fi / 2) * 1.6;
        const side = (fi % 2 ? 1 : -1) * 1.1;
        const h = e.ctrl.facing;
        target = new THREE.Vector3(p.x - Math.sin(h) * back + Math.cos(h) * side, 0, p.z - Math.cos(h) * back - Math.sin(h) * side);
        fi++;
        const d = n.pos.distanceTo(target);
        if (d > 30) n.pos.copy(target);
        speed = d > 4 ? 7.8 : d > 1 ? 3.5 : 0;
      } else {
        if (n.wait > 0) n.wait -= dt;
        else if (!n.goal) n.goal = randomSpot(n.pos, 18);
        target = n.goal;
      }
      let moving = false;
      if (target && speed > 0) {
        const dx = target.x - n.pos.x, dz = target.z - n.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) {
          const step = Math.min(d, speed * dt);
          const nx = n.pos.x + (dx / d) * step, nz = n.pos.z + (dz / d) * step;
          if (!hits(nx, nz, 0.4)) {
            n.pos.x = nx;
            n.pos.z = nz;
            moving = true;
          } else if (!n.friend) {
            n.goal = null; // chocó: buscar otro lado
            n.wait = 0.5;
          } else {
            n.pos.x = nx; // los amigos se escurren para no quedarse atorados
            n.pos.z = nz;
            moving = true;
          }
          let df = Math.atan2(dx, dz) - n.facing;
          df = Math.atan2(Math.sin(df), Math.cos(df));
          n.facing += df * (1 - Math.exp(-9 * dt));
        } else if (!n.friend) {
          n.goal = null;
          n.wait = 1 + Math.random() * 3.5;
          if (Math.random() < 0.25) say(n, PHRASES[Math.floor(Math.random() * PHRASES.length)], 3);
        }
      }
      n.pos.y = groundAt(n.pos.x, n.pos.z);
      n.anim.speed = moving ? Math.min(1, speed / 6) + 0.25 : 0;
      n.anim.grounded = true;
      // si un carro pasa rapidísimo, se hacen a un lado
      if (isDriving) {
        const veh = vehicles[driving.current];
        if (Math.abs(veh.v) > 4 && n.pos.distanceTo(veh.pos) < 2.4) {
          const ax = n.pos.x - veh.pos.x, az = n.pos.z - veh.pos.z;
          const l = Math.hypot(ax, az) || 1;
          n.pos.x += (ax / l) * 2.5;
          n.pos.z += (az / l) * 2.5;
          n.anim.wave = 1;
          say(n, '¡Uy! 😲', 1.5);
        }
      }
    }
  };

  const hooks = useRef<LevelHooks>({});
  hooks.current = {
    onFall: (e) => e.ctrl.reset(spawn, e.ctrl.facing),
    control: (e, dt) => {
      if (thumb || driving.current < 0) return false;
      const veh = vehicles[driving.current];
      const moto = veh.spec.kind === 'moto';
      const maxV = moto ? 19 : 15;
      const accel = moto ? 15 : 12;
      const thr = useRun.getState().status === 'playing' ? input.moveY : 0;
      const steer = useRun.getState().status === 'playing' ? input.moveX : 0;
      if (thr > 0.1) veh.v = Math.min(maxV, veh.v + accel * thr * dt);
      else if (thr < -0.1) veh.v = Math.max(-6, veh.v + accel * thr * dt * 1.3);
      else veh.v *= Math.exp(-1.6 * dt);
      if (Math.abs(veh.v) < 0.05 && Math.abs(thr) < 0.1) veh.v = 0;
      const turn = steer * (moto ? 2.4 : 2) * Math.min(1, Math.abs(veh.v) / 5) * (veh.v < 0 ? -1 : 1);
      veh.heading -= turn * dt;
      veh.lean += ((moto ? -turn * 0.16 : 0) - veh.lean) * (1 - Math.exp(-6 * dt));
      const nx = veh.pos.x + Math.sin(veh.heading) * veh.v * dt;
      const nz = veh.pos.z + Math.cos(veh.heading) * veh.v * dt;
      if (hits(nx, nz, moto ? 0.8 : 1.5)) {
        if (Math.abs(veh.v) > 3) {
          sfx.bump();
          burst(veh.pos.clone().setY(1.2), '#ffffff', 10);
        }
        veh.v = -veh.v * 0.3;
      } else {
        veh.pos.x = nx;
        veh.pos.z = nz;
      }
      // la niña sentada en el asiento
      const seatZ = moto ? -0.25 : -0.35;
      const seatY = moto ? 0.5 : 0.47;
      e.ctrl.pos.set(veh.pos.x + Math.sin(veh.heading) * seatZ, seatY, veh.pos.z + Math.cos(veh.heading) * seatZ);
      e.ctrl.vel.set(0, 0, 0);
      e.ctrl.facing = veh.heading;
      e.followYaw = veh.heading + Math.PI;
      e.cam.dist = moto ? 10.5 : 12;
      return true;
    },
    onTick: (e, dt) => {
      if (thumb) return;
      const run = useRun.getState();
      updateNpcs(dt, e);
      // monedas
      const c = e.ctrl.pos.clone();
      c.y += 1.1;
      const reach = driving.current >= 0 ? 2.4 : 1.4;
      coins.forEach((coin, i) => {
        if (coin.taken) {
          coinTimers.current[i] -= dt;
          if (coinTimers.current[i] <= 0) {
            coin.pos.copy(randomSpot()).setY(1.1);
            coin.taken = false;
            coin.t = 0;
          }
          return;
        }
        if (coin.pos.distanceTo(c) < reach) {
          coin.taken = true;
          coinTimers.current[i] = 40 + Math.random() * 30;
          sfx.coin();
          burst(coin.pos, '#ffcf33', 10);
          run.addCoins(1);
        }
      });
      // golosina en la mano
      if (holdT.current > 0) {
        holdT.current -= dt;
        if (holdT.current <= 0) {
          if (e.anim.hold === 'icecream' || e.anim.hold === 'pizza') run.showToast('😋 ¡Ñam ñam! ¡Qué rico!');
          e.anim.hold = undefined;
        }
      }
      // botones (unas 7 veces por segundo)
      actAcc.current += dt;
      if (actAcc.current > 0.15) {
        actAcc.current = 0;
        updateActions();
      }
    },
  };

  useEffect(() => {
    if (!thumb) useRun.getState().set({ friends: friendCount() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <fog attach="fog" args={['#d7eeff', 45, 140]} />
      <PlayWorld
        platforms={platforms}
        spawn={spawn}
        yaw={0}
        killY={-8}
        avatar={avatar}
        hooks={hooks}
        thumb={thumb}
        onEngine={(e) => (engine.current = e)}
        camCollide
        camBlockers={canopies}
      />
      <Roads />
      <TreeTops />
      <Windows buildings={apartments} />
      <HouseDecor />
      <ShopsDecor />
      <ParkDecor />
      <Signs houseName={playerName || 'Bloxi'} />
      {vehicles.map((v, i) => (
        <VehicleView key={i} veh={v} innerRef={(o) => (vehRefs.current[i] = o)} />
      ))}
      <NpcsView npcs={npcs} />
      <Coins coins={coins} />
      <Bursts />
      {[[-50, 22, -40, 3], [40, 24, -50, 2.6], [-60, 20, 40, 2.8], [50, 26, 50, 3], [0, 30, -70, 3.5], [-20, 28, 70, 3]].map(([x, y, z, sc], i) => (
        <Cloud key={i} position={[x, y, z]} scale={sc} />
      ))}
    </>
  );
}

function VehicleView({ veh, innerRef }: { veh: Vehicle; innerRef: (o: THREE.Group | null) => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    o.position.copy(veh.pos);
    o.rotation.set(0, veh.heading, 0);
    o.rotateZ(veh.lean);
  });
  return (
    <group
      ref={(o) => {
        ref.current = o;
        innerRef(o);
      }}
      position={veh.pos}
      rotation={[0, veh.heading, 0]}
    >
      {veh.spec.kind === 'car' ? <CarModel color={veh.spec.color} /> : <MotoModel color={veh.spec.color} />}
    </group>
  );
}

function NpcsView({ npcs }: { npcs: Npc[] }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const bubbles = useRef<(THREE.Sprite | null)[]>([]);
  const tags = useMemo(() => npcs.map((n) => nameTag(n.friend ? `💖 ${n.name}` : n.name)), [npcs]);
  const friendTags = useMemo(() => npcs.map((n) => nameTag(`💖 ${n.name}`)), [npcs]);
  const tagRefs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(() => {
    npcs.forEach((n, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = !n.hidden;
      g.position.copy(n.pos);
      g.rotation.y = n.facing;
      const b = bubbles.current[i];
      if (b) {
        b.visible = !!n.bubble;
        if (n.bubble) b.material = bubbleMat(n.bubble);
      }
      const t = tagRefs.current[i];
      if (t && n.friend && t.material !== friendTags[i]) t.material = friendTags[i];
    });
  });
  return (
    <>
      {npcs.map((n, i) => (
        <group key={i} ref={(o) => void (groups.current[i] = o)} position={n.pos}>
          <Avatar config={n.cfg} anim={n.anim} />
          <sprite ref={(o) => void (tagRefs.current[i] = o)} material={tags[i]} position={[0, 2.95, 0]} scale={[0.15, 0.0375, 1]} />
          <sprite ref={(o) => void (bubbles.current[i] = o)} position={[0, 3.55, 0]} scale={[0.28, 0.066, 1]} visible={false} />
        </group>
      ))}
    </>
  );
}
