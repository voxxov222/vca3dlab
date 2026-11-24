import * as THREE from 'three';
import type { FoilStyle, LayerMaterialFinish } from '../types/card';
import { getPbrTextureSet } from '../utils/pbrTextures';

export interface FoilUniforms {
  uFoilTime: { value: number };
  uFoilStyle: { value: number }; // 0=none, 1=prism, 2=cosmos, 3=etched_gold, 4=cracked_ice, 5=starlight
  uFoilIntensity: { value: number };
  uFoilLayerWeight: { value: number };
  uFoilColor: { value: THREE.Color };
  uFoilScale: { value: number };
  uFoilFresnel: { value: number };
  uFoilSweepSpeed: { value: number };
}

export function foilStyleToIndex(style: FoilStyle): number {
  switch (style) {
    case 'prism':
      return 1;
    case 'cosmos':
      return 2;
    case 'etched_gold':
      return 3;
    case 'cracked_ice':
      return 4;
    case 'starlight':
      return 5;
    case 'none':
    default:
      return 0;
  }
}

export function applyMaterialFinishAndPbr(
  mat: THREE.MeshPhysicalMaterial,
  finish: LayerMaterialFinish | undefined,
  pbrTextureId: string | undefined,
  maxAniso: number,
  isForeground = false
): void {
  const pbr = pbrTextureId ? getPbrTextureSet(pbrTextureId, maxAniso) : null;
  if (pbr) {
    mat.normalMap = pbr.normalMap;
    mat.roughnessMap = pbr.roughnessMap;
    mat.normalScale.set(0.65, 0.65);
  } else {
    mat.normalMap = null;
    mat.roughnessMap = null;
  }

  if (finish === 'metallic') {
    mat.roughness = pbr ? pbr.roughness : 0.18;
    mat.metalness = pbr ? pbr.metalness : 0.85;
    mat.clearcoat = 0.85;
    mat.iridescence = 0.15;
  } else if (finish === 'matte') {
    mat.roughness = 0.82;
    mat.metalness = 0.04;
    mat.clearcoat = 0.05;
    mat.iridescence = 0;
  } else if (finish === 'glossy') {
    mat.roughness = 0.12;
    mat.metalness = 0.18;
    mat.clearcoat = 1.0;
    mat.iridescence = 0.25;
  } else if (finish === 'holographic') {
    mat.roughness = 0.16;
    mat.metalness = 0.55;
    mat.clearcoat = 1.0;
    mat.iridescence = 1.0;
    mat.iridescenceIOR = 1.45;
  } else {
    mat.roughness = pbr ? pbr.roughness : isForeground ? 0.24 : 0.34;
    mat.metalness = pbr ? pbr.metalness : isForeground ? 0.35 : 0.14;
    mat.clearcoat = 0.65;
    mat.iridescence = 0;
  }
  mat.needsUpdate = true;
}

export function createCardLayerMaterial(
  texture: THREE.Texture,
  opacity: number,
  foilUniforms: FoilUniforms,
  isForegroundFrame = false
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    opacity,
    alphaTest: 0.015,
    side: THREE.DoubleSide,
    roughness: isForegroundFrame ? 0.24 : 0.34,
    metalness: isForegroundFrame ? 0.35 : 0.14,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    reflectivity: 0.85,
  });

  mat.userData.foilUniforms = foilUniforms;
  mat.customProgramCacheKey = () => 'vca-card-foil-v2';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFoilTime = foilUniforms.uFoilTime;
    shader.uniforms.uFoilStyle = foilUniforms.uFoilStyle;
    shader.uniforms.uFoilIntensity = foilUniforms.uFoilIntensity;
    shader.uniforms.uFoilLayerWeight = foilUniforms.uFoilLayerWeight;
    shader.uniforms.uFoilColor = foilUniforms.uFoilColor;
    shader.uniforms.uFoilScale = foilUniforms.uFoilScale;
    shader.uniforms.uFoilFresnel = foilUniforms.uFoilFresnel;
    shader.uniforms.uFoilSweepSpeed = foilUniforms.uFoilSweepSpeed;

    shader.vertexShader =
      `varying vec2 vFoilUv;\nvarying vec3 vFoilLocalPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFoilUv = uv;
        vFoilLocalPos = position;`
      );

    const foilGlsl = `
      uniform float uFoilTime;
      uniform float uFoilStyle;
      uniform float uFoilIntensity;
      uniform float uFoilLayerWeight;
      uniform vec3 uFoilColor;
      uniform float uFoilScale;
      uniform float uFoilFresnel;
      uniform float uFoilSweepSpeed;
      varying vec2 vFoilUv;
      varying vec3 vFoilLocalPos;

      float foilHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float foilNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(foilHash(i), foilHash(i + vec2(1.0, 0.0)), u.x),
          mix(foilHash(i + vec2(0.0, 1.0)), foilHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      vec3 foilSpectrum(float t) {
        vec3 a = vec3(0.55, 0.55, 0.58);
        vec3 b = vec3(0.45, 0.45, 0.42);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      float voronoiCrackle(vec2 x, out float cellHash) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float md = 8.0;
        cellHash = 0.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = vec2(foilHash(n + g), foilHash(n + g + vec2(17.3, 41.9)));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) {
              md = d;
              cellHash = foilHash(n + g + vec2(7.1, 13.7));
            }
          }
        }
        return sqrt(md);
      }
    `;

    shader.fragmentShader =
      foilGlsl +
      shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        `
        #include <lights_fragment_begin>
        if (uFoilStyle > 0.5 && uFoilIntensity > 0.001 && uFoilLayerWeight > 0.001) {
          vec3 fViewDir = normalize(vViewPosition);
          float ndv = clamp(dot(normal, fViewDir), 0.0, 1.0);
          float tiltAngle = atan(fViewDir.x, fViewDir.z) * 1.4 + fViewDir.y * 2.2;
          float fresnel = pow(1.0 - ndv, 1.85) * uFoilFresnel;
          float strength = uFoilIntensity * uFoilLayerWeight;
          vec2 scaledUv = (vFoilUv - 0.5) * max(0.35, uFoilScale) + 0.5;
          vec3 foilContrib = vec3(0.0);

          // Animated diagonal collectible sweep beam
          float sweepCoord = (vFoilUv.x * 0.72 + vFoilUv.y * 0.68) - fract(uFoilTime * 0.18 * uFoilSweepSpeed) * 2.2 + 0.5;
          float sweepBeam = exp(-sweepCoord * sweepCoord * 28.0) * 0.85 * step(0.05, uFoilSweepSpeed);

          if (uFoilStyle < 1.5) {
            float diag = dot(scaledUv, vec2(0.85, 0.52)) * 4.5 + tiltAngle * 1.6 + uFoilTime * 0.25;
            float sheenBand = smoothstep(0.15, 0.95, 0.5 + 0.5 * sin(diag * 2.4 + normal.x * 4.0));
            vec3 rainbow = foilSpectrum(diag + normal.y * 0.5 + fresnel * 0.65);
            foilContrib = rainbow * (0.28 + 0.72 * sheenBand) * (0.35 + fresnel * 0.95);
          } else if (uFoilStyle < 2.5) {
            vec2 grid = scaledUv * vec2(26.0, 36.0);
            vec2 cid = floor(grid);
            vec2 cf = fract(grid) - 0.5;
            float rnd = foilHash(cid);
            float glint = 0.0;
            if (rnd > 0.84) {
              float phase = rnd * 18.0 + tiltAngle * 3.5 + uFoilTime * 1.8;
              float flash = pow(max(0.0, sin(phase)), 6.0);
              glint = smoothstep(0.32, 0.02, length(cf)) * flash * 2.2;
            }
            float neb = foilNoise(scaledUv * 5.0 + vec2(tiltAngle * 0.4, uFoilTime * 0.12));
            vec3 cosColor = mix(vec3(0.25, 0.45, 1.0), vec3(0.95, 0.35, 0.85), neb);
            foilContrib = cosColor * (0.22 + fresnel * 0.65) + vec3(0.95, 0.98, 1.0) * glint;
          } else if (uFoilStyle < 3.5) {
            float lines = 0.5 + 0.5 * sin(scaledUv.x * 160.0 + scaledUv.y * 40.0 + normal.x * 8.0);
            float sweep = pow(max(0.0, cos((scaledUv.x - scaledUv.y) * 3.2 - tiltAngle * 1.8 - uFoilTime * 0.4)), 4.0);
            vec3 gold = mix(vec3(0.96, 0.72, 0.18), vec3(1.0, 0.93, 0.65), sweep);
            foilContrib = gold * (0.22 + sweep * 0.85 + lines * 0.18) * (0.4 + fresnel * 0.85);
          } else if (uFoilStyle < 4.5) {
            float cellH = 0.0;
            float dist = voronoiCrackle(scaledUv * vec2(11.0, 15.0), cellH);
            float facetAngle = cellH * 6.2831 + tiltAngle * 2.4 + normal.x * 3.0;
            float facetCatch = pow(max(0.0, cos(facetAngle)), 5.0);
            vec3 iceTint = mix(vec3(0.55, 0.88, 1.0), foilSpectrum(cellH + tiltAngle * 0.35), 0.55);
            float edge = smoothstep(0.02, 0.12, dist);
            foilContrib = iceTint * (0.2 + facetCatch * 1.45) * (0.45 + fresnel * 0.8) * (0.7 + 0.3 * edge);
          } else {
            vec2 sgrid = scaledUv * vec2(48.0, 68.0);
            vec2 sid = floor(sgrid);
            vec2 sf = fract(sgrid) - 0.5;
            float h = foilHash(sid);
            float sparkle = 0.0;
            if (h > 0.78) {
              float tw = pow(max(0.0, sin(h * 40.0 + tiltAngle * 4.5 + uFoilTime * 2.4)), 8.0);
              sparkle = smoothstep(0.35, 0.0, length(sf)) * tw * 2.5;
            }
            vec3 pearl = foilSpectrum(ndv * 1.3 + scaledUv.y * 0.4 + uFoilTime * 0.15);
            foilContrib = pearl * (0.15 + fresnel * 0.55) + vec3(1.0, 0.98, 0.92) * sparkle;
          }

          foilContrib = foilContrib * uFoilColor + vec3(1.0, 0.98, 0.94) * sweepBeam * uFoilColor;
          totalEmissiveRadiance += foilContrib * strength * 0.52 * diffuseColor.a;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + foilContrib * 0.32, clamp(strength, 0.0, 1.0));
        }
        `
      );
  };

  return mat;
}
