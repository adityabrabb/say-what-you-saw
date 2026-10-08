"use client";

import { useEffect, useRef } from "react";
import type { Material, Mesh } from "three";

// A small low-poly neon moon for the landing screen: flat-shaded core lit pink and cyan,
// a green wireframe shell, a tilted ring with a dotted halo, and a tiny orbiting moonlet.
// three.js is loaded lazily so the landing paints first, and the loop pauses when hidden.
export default function NeonMoon() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      const host = mount.current;
      if (disposed || !host) return;

      const size = host.clientWidth;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(size, size);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      camera.position.set(0, 0, 7);

      const world = new THREE.Group();
      world.rotation.z = 0.35;
      scene.add(world);

      // Core: chunky flat-shaded icosphere.
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshPhongMaterial({ color: 0x6a35c8, emissive: 0x220a4a, flatShading: true, shininess: 80 })
      );
      world.add(core);

      // Neon wireframe shell slightly larger than the core.
      const shell = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.06, 1)),
        new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.55 })
      );
      world.add(shell);

      // Tilted ring plus a dotted halo spinning the other way.
      const ringGroup = new THREE.Group();
      ringGroup.rotation.x = Math.PI / 2.4;
      world.add(ringGroup);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.6, 96),
        new THREE.MeshBasicMaterial({ color: 0xff2bd6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ringGroup.add(ring);
      const dots = new Float32Array(120 * 3);
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        dots.set([Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0], i * 3);
      }
      const halo = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dots, 3)),
        new THREE.PointsMaterial({ color: 0x00f0ff, size: 0.045, transparent: true, opacity: 0.9 })
      );
      ringGroup.add(halo);

      // Moonlet on its own orbit.
      const moonletOrbit = new THREE.Group();
      moonletOrbit.rotation.x = -0.5;
      world.add(moonletOrbit);
      const moonlet = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe600 })
      );
      moonlet.position.set(2.25, 0, 0);
      moonletOrbit.add(moonlet);

      // Soft glow: a radial-gradient sprite behind everything, additive so it never looks muddy.
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 128;
      const g = glowCanvas.getContext("2d")!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255, 43, 214, 0.55)");
      grad.addColorStop(0.45, "rgba(120, 40, 255, 0.25)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const glowTexture = new THREE.CanvasTexture(glowCanvas);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
      );
      glow.scale.set(5.2, 5.2, 1);
      glow.position.z = -1.5;
      scene.add(glow);

      // Neon rim lights.
      scene.add(new THREE.AmbientLight(0x4a1a8a, 0.9));
      const pink = new THREE.PointLight(0xff2bd6, 40, 20);
      pink.position.set(-4, 2, 3);
      scene.add(pink);
      const cyan = new THREE.PointLight(0x00f0ff, 34, 20);
      cyan.position.set(4, -1.5, 2.5);
      scene.add(cyan);

      // Gentle parallax toward the pointer.
      const pointer = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        pointer.x = e.clientX / window.innerWidth - 0.5;
        pointer.y = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let visible = true;
      const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
      io.observe(host);

      const start = performance.now();
      let raf = 0;
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const t = (now - start) / 1000;
        const intro = Math.min(1, t / 1.4);
        const pop = 1 - Math.pow(1 - intro, 3);
        world.scale.setScalar(0.2 + 0.8 * pop);
        const speed = reduced ? 0 : 1;
        core.rotation.y = t * 0.25 * speed;
        shell.rotation.y = -t * 0.12 * speed;
        shell.rotation.x = t * 0.05 * speed;
        halo.rotation.z = -t * 0.3 * speed;
        ring.rotation.z = t * 0.1 * speed;
        moonletOrbit.rotation.y = t * 0.9 * speed;
        moonlet.rotation.x = t * 2 * speed;
        world.rotation.x += (pointer.y * 0.4 - world.rotation.x) * 0.04;
        world.rotation.y += (pointer.x * 0.6 - world.rotation.y) * 0.04;
        glow.material.opacity = 0.85 + Math.sin(t * 1.6) * 0.15;
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          const m = o as Mesh;
          m.geometry?.dispose();
          const mat = m.material as Material | Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
        });
        glowTexture.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={mount} className="neon-moon" aria-hidden />;
}
