import * as THREE from 'three';
import { Enemy } from './effects/common';
import { insideTelegraph, type TelegraphSpec } from './effects/telegraph';

/**
 * A blue player dummy you move with WASD / arrow keys to dodge telegraphed zones. At each zone's impact
 * (and every 0.5 s while a lingering zone stays dangerous) it is tested: inside → HIT (red flash, knockback),
 * close but outside → DODGED.
 */
export class PlayerDummy {
  readonly figure = new Enemy({ color: 0x2f6fd0, horns: false, eyeColor: new THREE.Color(0.4, 1.6, 2) });
  readonly group = this.figure.group;
  enabled = false;
  speed = 7;
  hits = 0;
  dodges = 0;

  private keys = new Set<string>();
  private marker: THREE.Mesh;
  private flash = 0;
  private knock = new THREE.Vector3();
  private lastTested = new Map<number, number>(); // zone index → last test time
  private labels: { el: HTMLDivElement; t: number; pos: THREE.Vector3 }[] = [];
  private overlay: HTMLDivElement;

  constructor(private camera: THREE.Camera) {
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 40),
      new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.04;
    this.group.add(this.marker);
    this.group.visible = false;
    this.figure.setHome(new THREE.Vector3(4, 0, 3));

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:700 18px ui-sans-serif,system-ui;';
    document.body.appendChild(this.overlay);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        if (this.enabled) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
    if (!on) this.overlay.textContent = '';
  }

  /** New cast: forget which zones were already tested. */
  onPlay() {
    this.lastTested.clear();
  }

  update(dt: number, effectTime: number, zones: TelegraphSpec[]) {
    if (!this.enabled) return;
    // Camera-relative movement on the ground plane.
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (this.keys.has('w') || this.keys.has('arrowup')) move.add(fwd);
    if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(fwd);
    if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right);
    if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      this.group.position.add(move);
      this.group.rotation.y = Math.atan2(move.x, move.z);
    }
    this.group.position.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.exp(-dt * 6));

    // Zone tests.
    const p = this.group.position;
    zones.forEach((z, i) => {
      const until = Math.max(z.impact, z.until ?? z.impact);
      if (effectTime < z.impact || effectTime > until + 1e-3) return;
      const last = this.lastTested.get(i);
      if (last !== undefined && effectTime - last < 0.5) return;
      this.lastTested.set(i, effectTime);
      if (insideTelegraph(z.shape, p.x, p.z)) {
        this.hits++;
        this.flash = 1;
        const away = new THREE.Vector3(p.x - this.zoneCentre(z).x, 0, p.z - this.zoneCentre(z).z);
        if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
        this.knock.copy(away.normalize().multiplyScalar(9));
        this.say('HIT', '#ff5a4a');
      } else if (last === undefined && this.near(z, p)) {
        this.dodges++;
        this.say('DODGED', '#6aff9a');
      }
    });

    this.flash *= Math.exp(-dt * 5);
    this.figure.material.emissive.setRGB(2.2 * this.flash, 0.1 * this.flash, 0.05 * this.flash);
    this.updateLabels(dt);
  }

  private zoneCentre(z: TelegraphSpec) {
    const s = z.shape;
    return s.kind === 'line' ? { x: (s.x1 + s.x2) / 2, z: (s.z1 + s.z2) / 2 } : { x: s.x, z: s.z };
  }

  /** Close enough to the zone that getting out of it counts as a dodge. */
  private near(z: TelegraphSpec, p: THREE.Vector3) {
    const c = this.zoneCentre(z);
    const s = z.shape;
    const reach = s.kind === 'circle' ? s.radius : s.kind === 'ring' ? s.outer : s.kind === 'cone' ? s.radius
      : Math.hypot(s.x2 - s.x1, s.z2 - s.z1) / 2 + s.width;
    return Math.hypot(p.x - c.x, p.z - c.z) < reach + 4;
  }

  private say(text: string, color: string) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `position:absolute;color:${color};text-shadow:0 2px 6px #000;transform:translate(-50%,-50%);`;
    this.overlay.appendChild(el);
    this.labels.push({ el, t: 0, pos: this.group.position.clone().add(new THREE.Vector3(0, 3, 0)) });
  }

  private updateLabels(dt: number) {
    const v = new THREE.Vector3();
    this.labels = this.labels.filter((l) => {
      l.t += dt;
      if (l.t > 1.1) { l.el.remove(); return false; }
      v.copy(l.pos).add(new THREE.Vector3(0, l.t * 1.2, 0)).project(this.camera);
      l.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      l.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
      l.el.style.opacity = String(1 - l.t / 1.1);
      return true;
    });
  }
}
