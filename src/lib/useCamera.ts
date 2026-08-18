import { useEffect, useRef, useState } from 'react'

export type CameraStage = 'idle' | 'connecting' | 'streaming' | 'error'

/**
 * Shared getUserMedia plumbing for the two screens that need a live camera preview
 * (S05b face registration, S09 face login). Extracted after S05b's own implementation
 * proved out the tricky part: attaching the stream must live in its own effect, decoupled
 * from the state update that requests it, because the <video> only mounts once render
 * picks up 'connecting'/'streaming' — assigning srcObject inline right after
 * getUserMedia() resolves races against that mount and silently attaches to a null ref.
 */
export function useCamera() {
  const [stage, setStage] = useState<CameraStage>('idle')
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video && mediaStream) {
      video.srcObject = mediaStream
      void video.play()
    }
  }, [mediaStream])

  // Stops the camera whenever the stream changes away or this hook's owner unmounts —
  // the light must never stay on.
  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop())
    }
  }, [mediaStream])

  const start = async () => {
    setStage('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setMediaStream(stream)
    } catch {
      setStage('error')
    }
  }

  const stop = () => {
    setMediaStream(null)
    setStage('idle')
  }

  /** Draws the current frame to a canvas, mirrored to match the mirrored live preview. */
  const captureCanvas = (): HTMLCanvasElement | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  return { stage, setStage, videoRef, start, stop, captureCanvas }
}
