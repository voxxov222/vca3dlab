import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export interface LoadedModel3D {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  dispose: () => void;
}

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();

function normalizeModelGroup(root: THREE.Object3D, targetSize = 1.65): THREE.Group {
  const wrapper = new THREE.Group();
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / maxDim;

  root.position.sub(center);
  root.scale.multiplyScalar(scale);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.layers.set(0);
    }
  });

  wrapper.add(root);
  return wrapper;
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        m.dispose();
      }
    }
  });
}

/**
 * Builds multi-part composite procedural 3D collectible meshes (4-6 distinct sub-parts)
 * so artists can drop genuine 3D objects into any card layer with zero external dependencies.
 */
export function buildProceduralModel3D(modelId: string): LoadedModel3D {
  const root = new THREE.Group();

  if (modelId === 'arcane_ring') {
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.16,
      clearcoat: 0.9,
    });
    const violetMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6,
      metalness: 0.45,
      roughness: 0.14,
      emissive: 0x3b0764,
      emissiveIntensity: 0.65,
      iridescence: 1.0,
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.045, 16, 48), goldMat);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.03, 14, 42), violetMat);
    innerRing.rotation.x = 0.25;
    root.add(outerRing, innerRing);

    const nodeGeo = new THREE.OctahedronGeometry(0.085, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const node = new THREE.Mesh(nodeGeo, goldMat);
      node.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0);
      root.add(node);
    }
  } else if (modelId === 'elemental_orb') {
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.2,
      roughness: 0.08,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      clearcoat: 1.0,
      iridescence: 1.0,
    });
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      metalness: 0.85,
      roughness: 0.22,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), coreMat);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.025, 12, 36), shellMat);
    ring1.rotation.set(Math.PI * 0.35, 0.2, 0);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.02, 12, 36), shellMat);
    ring2.rotation.set(-Math.PI * 0.25, -0.45, 0.3);
    root.add(core, ring1, ring2);
  } else if (modelId === 'star_crest') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.72 : 0.32;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const starGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    starGeo.center();
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      metalness: 0.94,
      roughness: 0.15,
      clearcoat: 0.8,
    });
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      metalness: 0.15,
      roughness: 0.08,
      emissive: 0x0e7490,
      emissiveIntensity: 0.45,
      clearcoat: 1.0,
    });
    const starMesh = new THREE.Mesh(starGeo, goldMat);
    const centerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), gemMat);
    centerGem.position.z = 0.12;
    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.025, 12, 42), goldMat);
    root.add(starMesh, centerGem, haloRing);
  } else {
    // crystal_gem default
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.18,
      roughness: 0.1,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.5,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.35,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.18,
    });

    const mainPrism = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), crystalMat);
    mainPrism.scale.set(0.82, 1.55, 0.72);
    const leftShard = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalMat);
    leftShard.scale.set(0.7, 1.35, 0.7);
    leftShard.position.set(-0.38, -0.15, 0.05);
    leftShard.rotation.z = 0.32;
    const rightShard = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), crystalMat);
    rightShard.scale.set(0.7, 1.25, 0.7);
    rightShard.position.set(0.36, -0.18, -0.04);
    rightShard.rotation.z = -0.28;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.022, 10, 32), trimMat);
    collar.rotation.x = Math.PI * 0.42;
    collar.position.y = -0.32;
    root.add(mainPrism, leftShard, rightShard, collar);
  }

  return {
    group: root,
    mixer: null,
    dispose: () => disposeObjectTree(root),
  };
}

export async function loadExternalModel3D(
  url: string,
  format: 'glb' | 'gltf' | 'obj'
): Promise<LoadedModel3D> {
  if (format === 'obj') {
    const obj = await new Promise<THREE.Group>((resolve, reject) => {
      objLoader.load(url, resolve, undefined, reject);
    });
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (!m.material) {
          m.material = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            roughness: 0.32,
            metalness: 0.45,
          });
        }
      }
    });
    const normalized = normalizeModelGroup(obj);
    return {
      group: normalized,
      mixer: null,
      dispose: () => disposeObjectTree(normalized),
    };
  }

  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
    (resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    }
  );
  const normalized = normalizeModelGroup(gltf.scene);
  let mixer: THREE.AnimationMixer | null = null;
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(normalized);
    gltf.animations.forEach((clip) => {
      mixer!.clipAction(clip).play();
    });
  }

  return {
    group: normalized,
    mixer,
    dispose: () => {
      mixer?.stopAllAction();
      disposeObjectTree(normalized);
    },
  };
}
