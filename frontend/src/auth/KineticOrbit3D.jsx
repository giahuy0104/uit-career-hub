import { useEffect, useRef } from "react";
import {
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
} from "three";

export function KineticOrbit3D() {
  const hostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let resizeObserver;
    let intersectionObserver;
    let renderer;
    let scene;
    let camera;
    let orbitGroup;
    let rings = [];
    let visible = true;
    let lastFrame = performance.now();
    const pointer = { x: 0, y: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handlePointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.34;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.24;
    };

    const initialize = () => {
      if (cancelled || !hostRef.current) return;

      const host = hostRef.current;
      scene = new Scene();
      camera = new PerspectiveCamera(31, 1, 0.1, 100);
      camera.position.set(0, 0.08, 7.2);

      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.className = "kinetic-orbit-canvas";
      host.appendChild(renderer.domElement);

      orbitGroup = new Group();
      orbitGroup.rotation.set(-0.12, -0.18, 0.04);
      scene.add(orbitGroup);

      const navyMaterial = new MeshPhysicalMaterial({
        color: 0x102a4d,
        roughness: 0.28,
        metalness: 0.34,
        clearcoat: 0.5,
        clearcoatRoughness: 0.32,
      });
      const blueMaterial = new MeshPhysicalMaterial({
        color: 0x0b70e8,
        roughness: 0.24,
        metalness: 0.3,
        clearcoat: 0.62,
        clearcoatRoughness: 0.25,
      });
      const slateMaterial = new MeshPhysicalMaterial({
        color: 0x294b72,
        roughness: 0.32,
        metalness: 0.28,
        clearcoat: 0.4,
      });
      const amberMaterial = new MeshPhysicalMaterial({
        color: 0xf4a019,
        emissive: 0x5e2f00,
        emissiveIntensity: 0.08,
        roughness: 0.22,
        metalness: 0.38,
        clearcoat: 0.7,
      });

      const ringGeometry = new TorusGeometry(1.25, 0.105, 28, 144);
      rings = [
        new Mesh(ringGeometry, navyMaterial),
        new Mesh(ringGeometry, blueMaterial),
        new Mesh(ringGeometry, slateMaterial),
      ];
      rings[0].rotation.set(Math.PI / 2.15, 0.18, 0.15);
      rings[1].rotation.set(0.2, Math.PI / 2.28, -0.35);
      rings[2].rotation.set(Math.PI / 2.65, Math.PI / 3.4, 0.42);
      rings.forEach((ring) => {
        ring.castShadow = true;
        orbitGroup.add(ring);
      });

      const core = new Mesh(new SphereGeometry(0.28, 48, 48), amberMaterial);
      core.castShadow = true;
      orbitGroup.add(core);

      const softShadow = new Mesh(
        new CircleGeometry(1.08, 64),
        new MeshBasicMaterial({ color: 0x12355d, transparent: true, opacity: 0.09, depthWrite: false }),
      );
      softShadow.scale.set(1.45, 0.42, 1);
      softShadow.position.set(0.08, -1.58, -0.45);
      scene.add(softShadow);

      scene.add(new HemisphereLight(0xeaf4ff, 0x25364c, 2.5));
      const keyLight = new DirectionalLight(0xffffff, 3.8);
      keyLight.position.set(-3.5, 4.5, 5.5);
      keyLight.castShadow = true;
      scene.add(keyLight);
      const blueRim = new PointLight(0x5fa7ff, 3.2, 13);
      blueRim.position.set(3.3, 1.8, 3.8);
      scene.add(blueRim);
      const amberFill = new PointLight(0xffb44d, 1.4, 8);
      amberFill.position.set(-1.4, -1.2, 3.2);
      scene.add(amberFill);

      const resize = () => {
        if (!hostRef.current || !renderer || !camera) return;
        const { width, height } = hostRef.current.getBoundingClientRect();
        if (width < 2 || height < 2) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      intersectionObserver = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      }, { threshold: 0.05 });
      intersectionObserver.observe(host);
      resize();

      const animate = (now) => {
        if (cancelled) return;
        const delta = Math.min((now - lastFrame) / 1000, 0.05);
        lastFrame = now;

        if (visible && !document.hidden) {
          const motionScale = reducedMotion.matches ? 0 : 1;
          orbitGroup.rotation.y += delta * 0.34 * motionScale;
          orbitGroup.rotation.x += (pointer.y * motionScale - orbitGroup.rotation.x) * 0.035;
          orbitGroup.rotation.z += (pointer.x * motionScale - orbitGroup.rotation.z) * 0.028;
          rings[0].rotation.z += delta * 0.19 * motionScale;
          rings[1].rotation.x -= delta * 0.15 * motionScale;
          rings[2].rotation.y += delta * 0.12 * motionScale;
          renderer.render(scene, camera);
        }

        animationFrame = requestAnimationFrame(animate);
      };

      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      animationFrame = requestAnimationFrame(animate);
    };

    try {
      initialize();
    } catch {
      if (hostRef.current) hostRef.current.dataset.webgl = "unavailable";
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (scene) {
        scene.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
          else object.material?.dispose?.();
        });
      }
      renderer?.dispose();
      renderer?.domElement?.remove();
    };
  }, []);

  return <div ref={hostRef} className="kinetic-orbit" aria-hidden="true" />;
}
