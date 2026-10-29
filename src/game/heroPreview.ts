import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Hero } from '../effects/weapons/hero';

/**
 * A small turntable for the heroes page: its own renderer and scene (lights, a dark plinth) showing one hero
 * model, turning slowly. It only renders while its canvas is in the page and visible.
 */
export class HeroPreview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private figures = new Map<string, Hero>();
  private current: Hero | null = null;
  private yaw = 0.4;
  private last = performance.now();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'hero-preview';
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x20160f, 0.7));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(3, 6, 5);
    const rim = new THREE.DirectionalLight(0x8fa8ff, 1.2);
    rim.position.set(-4, 4, -6);
    this.scene.add(key, rim);
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 0.7, metalness: 0.2 }),
    );
    plinth.position.y = -0.08;
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.015, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xc9a24a }),
    );
    rimRing.rotation.x = Math.PI / 2;
    this.scene.add(plinth, rimRing);
    this.camera.position.set(0, 1.55, 6.2);
    this.camera.lookAt(0, 1.2, 0);
    this.loop();
  }

  /** Shows the model at `url` (cached per url). */
  show(url: string | undefined) {
    if (this.current) this.current.root.visible = false;
    this.current = null;
    if (!url) return;
    let f = this.figures.get(url);
    if (!f) {
      f = new Hero({ url, shade: 0.9, maxEmissive: 1, tintSheen: true });
      this.figures.set(url, f);
      this.scene.add(f.root);
    }
    f.root.visible = true;
    this.current = f;
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.canvas.isConnected || this.canvas.offsetParent === null) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.yaw += dt * 0.5;
    if (this.current) this.current.root.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera);
  };
}
