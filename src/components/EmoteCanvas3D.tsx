import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Pause,
  Play,
  RotateCw,
  Video,
} from 'lucide-react';
import { CHARACTERS } from '../data/characters';
import { EmoteCharacterRig } from '../three/characterRig';
import {
  CharacterId,
  ExpressionParams,
  StudioLightingMood,
} from '../types/emote';

export type CameraPreset = 'hero' | 'portrait' | 'profile' | 'turntable';

export interface EmoteCanvasHandle {
  capturePng: (size?: number) => string | null;
  recordWebM: (durationMs?: number) => Promise<Blob | null>;
}

interface EmoteCanvas3DProps {
  characterId: CharacterId;
  params: ExpressionParams;
  lightingMood?: StudioLightingMood;
  onLightingChange?: (mood: StudioLightingMood) => void;
  showDock?: boolean;
  compact?: boolean;
  className?: string;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; label: string }
> = {
  hero: { pos: [0.95, 1.55, 3.35], target: [0, 1.25, 0], label: '3/4 Hero' },
  portrait: { pos: [0, 1.7, 2.1], target: [0, 1.58, 0], label: 'Portrait' },
  profile: { pos: [2.75, 1.48, 1.15], target: [0, 1.2, 0], label: 'Profile' },
  turntable: { pos: [0, 1.65, 3.85], target: [0, 1.15, 0], label: 'Full Rig' },
};

const MOOD_COLORS: Record<
  StudioLightingMood,
  { bg: string; key: string; rim: string; label: string }
> = {
  slate: { bg: '#3E5763', key: '#FFF5E8', rim: '#7DD3FC', label: 'Slate Studio' },
  sunset: { bg: '#3B2624', key: '#FDBA74', rim: '#FB7185', label: 'Amber Glow' },
  obsidian: { bg: '#0F161D', key: '#F8FAFC', rim: '#F97316', label: 'Obsidian' },
  gallery: { bg: '#CBD5E1', key: '#FFFDF7', rim: '#38BDF8', label: 'Light Box' },
};

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const EmoteCanvas3D = forwardRef<EmoteCanvasHandle, EmoteCanvas3DProps>(
  function EmoteCanvas3D(
    {
      characterId,
      params,
      lightingMood = 'slate',
      onLightingChange,
      showDock = true,
      compact = false,
      className = '',
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);

    // Mutable refs so React updates never tear down the WebGL context
    const paramsRef = useRef<ExpressionParams>(params);
    paramsRef.current = params;

    const playingRef = useRef(true);
    const autoRotateRef = useRef(false);
    const cameraPresetTargetRef = useRef<{
      pos: THREE.Vector3;
      target: THREE.Vector3;
      active: boolean;
    }>({
      pos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
      target: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
      active: false,
    });

    const sceneRefs = useRef<{
      renderer?: THREE.WebGLRenderer;
      scene?: THREE.Scene;
      camera?: THREE.PerspectiveCamera;
      controls?: OrbitControls;
      rig?: EmoteCharacterRig;
      keyLight?: THREE.DirectionalLight;
      rimLight?: THREE.DirectionalLight;
      anisotropy: number;
    }>({ anisotropy: 1 });

    const [playing, setPlaying] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [activePreset, setActivePreset] = useState<CameraPreset>('hero');
    const [dockCollapsed, setDockCollapsed] = useState(false);
    const [mood, setMood] = useState<StudioLightingMood>(lightingMood);
    const [contextLost, setContextLost] = useState(false);
    const [recording, setRecording] = useState(false);

    useEffect(() => {
      setMood(lightingMood);
    }, [lightingMood]);

    // Keyboard shortcut H for Cinema / Zen Mode
    useEffect(() => {
      if (!showDock) return;
      const onKey = (e: KeyboardEvent) => {
        if (
          e.key.toLowerCase() === 'h' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          setDockCollapsed((prev) => !prev);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [showDock]);

    // Expose real PNG & WebM export methods
    useImperativeHandle(ref, () => ({
      capturePng: (size = 512) => {
        const { renderer, scene, camera } = sceneRefs.current;
        if (!renderer || !scene || !camera) return null;
        const prevW = renderer.domElement.width;
        const prevH = renderer.domElement.height;
        const prevAspect = camera.aspect;
        const prevRatio = renderer.getPixelRatio();

        renderer.setPixelRatio(1);
        renderer.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');

        // Restore viewport dimensions
        renderer.setPixelRatio(prevRatio);
        renderer.setSize(prevW / prevRatio, prevH / prevRatio, false);
        camera.aspect = prevAspect;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        return dataUrl;
      },
      recordWebM: async (durationMs = 2400) => {
        const { renderer, scene, camera } = sceneRefs.current;
        if (!renderer || !scene || !camera) return null;
        const canvas = renderer.domElement;
        if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
          return null;
        }
        setRecording(true);
        return new Promise<Blob | null>((resolve) => {
          try {
            const stream = canvas.captureStream(30);
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (ev) => {
              if (ev.data.size > 0) chunks.push(ev.data);
            };
            recorder.onstop = () => {
              setRecording(false);
              resolve(new Blob(chunks, { type: mimeType }));
            };
            recorder.start();
            window.setTimeout(() => {
              if (recorder.state !== 'inactive') recorder.stop();
            }, durationMs);
          } catch {
            setRecording(false);
            resolve(null);
          }
        });
      },
    }));

    // Mount Three.js Scene ONCE
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareGl();
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
      } catch {
        setContextLost(true);
        return;
      }

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const width = Math.max(container.clientWidth, 320);
      const height = Math.max(container.clientHeight, 260);
      renderer.setSize(width, height);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const handleLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const handleRestored = () => setContextLost(false);
      renderer.domElement.addEventListener('webglcontextlost', handleLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

      const scene = new THREE.Scene();
      const moodSpec = MOOD_COLORS[mood];
      scene.background = new THREE.Color(moodSpec.bg);
      scene.fog = new THREE.FogExp2(moodSpec.bg, 0.065);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
      camera.position.set(...CAMERA_PRESETS.hero.pos);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...CAMERA_PRESETS.hero.target);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.minDistance = 1.35;
      controls.maxDistance = 5.2;
      controls.minPolarAngle = 0.45;
      controls.maxPolarAngle = Math.PI * 0.56;
      controls.addEventListener('start', () => {
        cameraPresetTargetRef.current.active = false;
      });
      controls.update();

      // 3-Point Studio Lighting Rig
      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.72);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight(moodSpec.key, 2.0);
      keyLight.position.set(2.4, 3.8, 3.4);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.camera.left = -2.2;
      keyLight.shadow.camera.right = 2.2;
      keyLight.shadow.camera.top = 3.0;
      keyLight.shadow.camera.bottom = -1.2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(moodSpec.rim, 1.35);
      rimLight.position.set(-2.5, 2.4, -2.6);
      scene.add(rimLight);

      if (!isSoftwareGl) {
        RectAreaLightUniformsLib.init();
        const softbox = new THREE.RectAreaLight(0xffffff, 2.6, 2.2, 2.2);
        softbox.position.set(-2.2, 2.0, 2.2);
        softbox.lookAt(0, 1.1, 0);
        scene.add(softbox);
      }

      const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      const rig = new EmoteCharacterRig(characterId, anisotropy);
      scene.add(rig.root);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      sceneRefs.current = {
        renderer,
        scene,
        camera,
        controls,
        rig,
        keyLight,
        rimLight,
        anisotropy,
      };

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(entry.contentRect.width, 100);
          const h = Math.max(entry.contentRect.height, 100);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      });
      resizeObserver.observe(container);

      let frameId = 0;
      let disposed = false;
      const clock = new THREE.Clock();

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || typeof gl.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function tick() {
        if (disposed) return;
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        const currentRig = sceneRefs.current.rig;
        if (currentRig) {
          currentRig.update(paramsRef.current, dt, elapsed, playingRef.current);
          if (autoRotateRef.current) {
            currentRig.root.rotation.y += dt * 0.65;
          } else {
            currentRig.root.rotation.y = THREE.MathUtils.damp(
              currentRig.root.rotation.y,
              0,
              6,
              Math.min(dt, 0.05)
            );
          }
        }

        // Smooth camera preset damping
        const camGoal = cameraPresetTargetRef.current;
        if (camGoal.active) {
          const dampDt = Math.min(dt, 0.05);
          camera.position.set(
            THREE.MathUtils.damp(camera.position.x, camGoal.pos.x, 7, dampDt),
            THREE.MathUtils.damp(camera.position.y, camGoal.pos.y, 7, dampDt),
            THREE.MathUtils.damp(camera.position.z, camGoal.pos.z, 7, dampDt)
          );
          controls.target.set(
            THREE.MathUtils.damp(controls.target.x, camGoal.target.x, 7, dampDt),
            THREE.MathUtils.damp(controls.target.y, camGoal.target.y, 7, dampDt),
            THREE.MathUtils.damp(controls.target.z, camGoal.target.z, 7, dampDt)
          );
          if (camera.position.distanceTo(camGoal.pos) < 0.015) {
            camGoal.active = false;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', handleLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
        sceneRefs.current.rig?.dispose();
        envTex.dispose();
        controls.dispose();
        renderer.dispose();
      };
    }, []);

    // Hot-swap Character Rig cleanly when characterId changes
    useEffect(() => {
      const { scene, rig, anisotropy } = sceneRefs.current;
      if (!scene || !rig || rig.characterId === characterId) return;
      scene.remove(rig.root);
      rig.dispose();
      const nextRig = new EmoteCharacterRig(characterId, anisotropy);
      scene.add(nextRig.root);
      sceneRefs.current.rig = nextRig;
    }, [characterId]);

    // Update studio lighting mood dynamically
    useEffect(() => {
      const { scene, keyLight, rimLight } = sceneRefs.current;
      if (!scene || !keyLight || !rimLight) return;
      const spec = MOOD_COLORS[mood];
      scene.background = new THREE.Color(spec.bg);
      scene.fog = new THREE.FogExp2(spec.bg, 0.065);
      keyLight.color.set(spec.key);
      rimLight.color.set(spec.rim);
    }, [mood]);

    const handlePreset = (preset: CameraPreset) => {
      setActivePreset(preset);
      const spec = CAMERA_PRESETS[preset];
      cameraPresetTargetRef.current.pos.set(...spec.pos);
      cameraPresetTargetRef.current.target.set(...spec.target);
      cameraPresetTargetRef.current.active = true;
    };

    const togglePlaying = () => {
      playingRef.current = !playingRef.current;
      setPlaying(playingRef.current);
    };

    const toggleAutoRotate = () => {
      autoRotateRef.current = !autoRotateRef.current;
      setAutoRotate(autoRotateRef.current);
    };

    const handleQuickSnapshot = () => {
      const { renderer, scene, camera } = sceneRefs.current;
      if (!renderer || !scene || !camera) return;
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${characterId}-emote-snapshot.png`;
      a.click();
    };

    const handleQuickWebM = async () => {
      const { renderer, scene, camera } = sceneRefs.current;
      if (!renderer || !scene || !camera) return;
      const canvas = renderer.domElement;
      if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        handleQuickSnapshot();
        return;
      }
      setRecording(true);
      try {
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          setRecording(false);
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${characterId}-emote-loop.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 2200);
      } catch {
        setRecording(false);
      }
    };

    const charProfile =
      CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];

    return (
      <div
        className={`relative w-full h-full overflow-hidden rounded-xl border border-white/10 bg-[#141D24] ${className}`}
      >
        {/* Isolated WebGL Container */}
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label={`Interactive 3D viewport for ${charProfile.name}`}
        />

        {/* Graceful Fallback if WebGL unavailable */}
        {contextLost && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141D24] p-6 text-center">
            {charProfile.referenceImage ? (
              <img
                src={charProfile.referenceImage}
                alt={charProfile.name}
                referrerPolicy="no-referrer"
                className="h-44 w-44 rounded-xl object-cover border border-white/10 mb-3"
              />
            ) : null}
            <p className="text-sm font-medium text-slate-200">
              3D WebGL Preview Paused
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hardware graphics context unavailable. Expression specs remain active.
            </p>
          </div>
        )}

        {/* Minimal Top-Left Character Label (non-blocking) */}
        {!compact && (
          <div className="pointer-events-none absolute top-3.5 left-4 z-10 flex items-center gap-2 text-xs text-slate-200/90">
            <span className="font-display font-semibold text-white">
              {charProfile.name}
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-300">Drag to orbit · Scroll to zoom</span>
          </div>
        )}

        {/* Unified Collapsible Bottom Control Dock (Zero backdrop-filter over WebGL) */}
        {showDock && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3.5 z-10 flex flex-col items-center px-3">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/15 bg-[#0C1115]/92 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              title="Toggle Studio Controls (H)"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Show Controls (H)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Hide Controls (H)</span>
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0C1115]/94 px-3 py-2 shadow-xl max-w-[94%]">
                {/* Camera Presets */}
                <div className="flex items-center gap-1 bg-[#162029] p-1 rounded-lg">
                  {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePreset(key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        activePreset === key
                          ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {CAMERA_PRESETS[key].label}
                    </button>
                  ))}
                </div>

                {/* Lighting Moods */}
                <div className="flex items-center gap-1 bg-[#162029] p-1 rounded-lg">
                  {(Object.keys(MOOD_COLORS) as StudioLightingMood[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMood(m);
                        onLightingChange?.(m);
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        mood === m
                          ? 'bg-[#253442] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {MOOD_COLORS[m].label}
                    </button>
                  ))}
                </div>

                {/* Playback & Export */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlaying}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#162029] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] transition-colors whitespace-nowrap shrink-0"
                    title={playing ? 'Pause Animation' : 'Play Animation'}
                  >
                    {playing ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>{playing ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleAutoRotate}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      autoRotate
                        ? 'border-[#F97316]/60 bg-[#F97316]/15 text-[#FB923C]'
                        : 'border-white/10 bg-[#162029] text-slate-200 hover:bg-[#1E2B37]'
                    }`}
                    title="Toggle Turntable Spin"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Spin</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickSnapshot}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#162029] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] transition-colors whitespace-nowrap shrink-0"
                    title="Download PNG Frame"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickWebM}
                    disabled={recording}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#162029] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    title="Record Animated WebM Loop"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>{recording ? 'Rec...' : 'WebM'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
