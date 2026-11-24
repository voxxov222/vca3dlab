import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildProceduralModel3D,
  loadExternalModel3D,
  type LoadedModel3D,
} from '../engine/modelLoader3D';

interface ModelPreviewMiniProps {
  proceduralModelId?: string;
  modelUrl?: string;
  modelFormat?: 'glb' | 'gltf' | 'obj' | 'procedural';
}

export const ModelPreviewMini: React.FC<ModelPreviewMiniProps> = ({
  proceduralModelId,
  modelUrl,
  modelFormat = 'procedural',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    let loadedModel: LoadedModel3D | null = null;

    const width = container.clientWidth || 220;
    const height = container.clientHeight || 180;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e16);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 40);
    camera.position.set(1.6, 1.0, 2.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'default',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.9);
    const key = new THREE.DirectionalLight(0xfff7ed, 2.0);
    key.position.set(2.5, 3.5, 3.0);
    scene.add(hemi, key);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.4;
    controls.minDistance = 1.4;
    controls.maxDistance = 5.5;

    const clock = new THREE.Clock();

    const initModel = async () => {
      try {
        setStatus('loading');
        if (
          modelUrl &&
          (modelFormat === 'glb' || modelFormat === 'gltf' || modelFormat === 'obj')
        ) {
          loadedModel = await loadExternalModel3D(modelUrl, modelFormat);
        } else {
          loadedModel = buildProceduralModel3D(proceduralModelId || 'crystal_gem');
        }
        if (disposed) {
          loadedModel.dispose();
          return;
        }
        scene.add(loadedModel.group);
        setStatus('ready');
      } catch {
        if (!disposed) {
          loadedModel = buildProceduralModel3D(proceduralModelId || 'crystal_gem');
          scene.add(loadedModel.group);
          setStatus('error');
        }
      }
    };

    initModel();

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      controls.update();
      if (loadedModel?.mixer) {
        loadedModel.mixer.update(dt);
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      controls.dispose();
      loadedModel?.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [proceduralModelId, modelUrl, modelFormat]);

  return (
    <div className="relative w-full h-[180px] rounded-lg overflow-hidden border border-white/10 bg-[#0b0e16]">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-slate-400 pointer-events-none">
        <span>Drag to orbit 3D model</span>
        {status === 'loading' && <span className="text-amber-300">Loading mesh...</span>}
        {status === 'error' && <span className="text-amber-300">Fallback mesh</span>}
      </div>
    </div>
  );
};
