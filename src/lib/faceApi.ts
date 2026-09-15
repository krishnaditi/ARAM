/**
 * Client-side face detection + matching, entirely on-device (models load from /models,
 * inference runs in the browser via TF.js — no image or descriptor ever leaves the device
 * unless the PostgreSQL API is configured, mirroring api.ts's existing mock-vs-API split).
 *
 * A face is represented as a 128-number descriptor, not the photo itself: registering and
 * verifying both reduce to "detect a face, describe it," and matching is just a distance
 * between two descriptors. This is the same reason PIN hashes are compared instead of PINs.
 */

const MODEL_URL = '/models'

// Euclidean distance below this is treated as the same person. 0.6 is face-api.js's own
// documented default threshold, tuned against its recognition model's training data.
export const FACE_MATCH_THRESHOLD = 0.6

// @vladmandic/face-api pulls in TF.js (~1.4MB) — dynamically imported so that chunk only
// ever loads on the two screens that actually use it (S05b, S09), instead of every screen
// paying for it. api.ts imports this file too (for descriptorDistance below) and api.ts is
// used almost everywhere, so keeping the face-api.js import itself dynamic is what matters,
// not whether the *caller* is dynamically imported.
const INFERENCE_TIMEOUT_MS = 20_000

type FaceApiModule = typeof import('@vladmandic/face-api')
let faceapiModule: Promise<FaceApiModule> | null = null
function loadFaceApiModule(): Promise<FaceApiModule> {
  if (!faceapiModule) {
    faceapiModule = import('@vladmandic/face-api').catch((error: unknown) => {
      faceapiModule = null
      throw error
    })
  }
  return faceapiModule
}

// face-api's typings omit TF.js engine controls that exist at runtime.
type TfEngine = {
  engine(): { reset(): void }
  getBackend(): string
  setBackend(name: string): Promise<boolean>
  ready(): Promise<void>
  backend(): { gpgpu?: { gl?: WebGLRenderingContext } }
}
const tfOf = (faceapi: FaceApiModule) => faceapi.tf as unknown as TfEngine

let modelsLoaded: Promise<void> | null = null
// A lost WebGL context hangs every later inference until the backend is rebuilt.
let contextLost = false

/** Idempotent + shared across callers: the first call kicks off loading, every later call
 * (from either S05b or S09) just awaits the same in-flight/completed promise. */
export function loadFaceModels(): Promise<void> {
  if (!modelsLoaded) {
    modelsLoaded = loadFaceApiModule()
      .then(async (faceapi) => {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        contextLost = false
        tfOf(faceapi)
          .backend()
          .gpgpu?.gl?.canvas.addEventListener('webglcontextlost', () => { contextLost = true }, { once: true })
      })
      .catch((error: unknown) => {
        modelsLoaded = null
        throw error
      })
  }
  return modelsLoaded
}

async function resetFaceBackend(faceapi: FaceApiModule): Promise<void> {
  const tf = tfOf(faceapi)
  const backendName = tf.getBackend()
  tf.engine().reset()
  await tf.setBackend(backendName)
  await tf.ready()
  modelsLoaded = null
  await loadFaceModels()
}

async function detectOnce(faceapi: FaceApiModule, input: HTMLVideoElement | HTMLCanvasElement) {
  await loadFaceModels()
  if (contextLost) throw new Error('WebGL context lost')
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Face detection timed out')), INFERENCE_TIMEOUT_MS)
  })
  try {
    const result = await Promise.race([
      faceapi.detectSingleFace(input, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor(),
      timeout,
    ])
    return result?.descriptor ?? null
  } finally {
    clearTimeout(timer)
  }
}

/** Detects the single largest face in the given frame and returns its 128-d descriptor,
 * or null if no face was found. Models are loaded on demand if not already warm. */
export async function getFaceDescriptor(
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<Float32Array | null> {
  const faceapi = await loadFaceApiModule()
  try {
    return await detectOnce(faceapi, input)
  } catch {
    // Rebuild the backend and retry once; a second failure throws to the caller.
    await resetFaceBackend(faceapi)
    return detectOnce(faceapi, input)
  }
}

/** Euclidean distance between two descriptors — lower means more similar. Implemented by
 * hand rather than via face-api.js so api.ts (imported almost everywhere) never pulls
 * face-api's TF.js dependency into the shared bundle just to compare two number arrays. */
export function descriptorDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}
