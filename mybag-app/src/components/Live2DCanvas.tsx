import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Application } from 'pixi.js'

// 动态导入以避免类型问题，同时确保插件已正确加载
import type { Live2DModel as Live2DModelType } from '@jannchie/pixi-live2d-display'

export interface Live2DCanvasHandle {
  setExpression: (expression: string) => void
  playMotion: (motion: string) => void
  setRandomMotion: () => void
}

interface Live2DCanvasProps {
  modelUrl: string
  width?: number
  height?: number
  autoMotion?: boolean
}

const Live2DCanvas = forwardRef<Live2DCanvasHandle, Live2DCanvasProps>(
  function Live2DCanvas({ modelUrl, width = 300, height = 500, autoMotion = true }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const appRef = useRef<Application | null>(null)
    const modelRef = useRef<Live2DModelType | null>(null)
    const motionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
      setExpression(expression: string) {
        modelRef.current?.expression?.(expression)
      },
      playMotion(motion: string) {
        modelRef.current?.motion?.(motion)
      },
      setRandomMotion() {
        const model = modelRef.current
        if (!model || !(model as any).internalModel) return
        try {
          const motionManager = (model as any).internalModel.motionManager
          if (motionManager) {
            model.motion('tap_body')
          }
        } catch {
          // 忽略没有动作管理器的情况
        }
      }
    }))

    useEffect(() => {
      let cancelled = false

      const init = async () => {
        if (!containerRef.current) return

        // 动态导入 Live2D 模型类
        const { Live2DModel } = await import('@jannchie/pixi-live2d-display')

        const app = new Application()

        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        })

        if (cancelled) {
          app.destroy(true, { children: true })
          return
        }

        appRef.current = app
        containerRef.current.appendChild(app.canvas as HTMLCanvasElement)

        try {
          const model = await Live2DModel.from(modelUrl)

          if (cancelled) {
            model.destroy()
            app.destroy(true, { children: true })
            return
          }

          modelRef.current = model

          app.stage.addChild(model as any)

          // 居中和缩放
          model.anchor.set(0.5, 0.5)
          model.x = width / 2
          model.y = height * 0.55
          model.scale.set(Math.min(width / 300, height / 450) * 0.8)

          // 点击交互 - 轻触身体
          ;(model as any).on('hit', (hitAreas: string[]) => {
            if (hitAreas.includes('body') || hitAreas.includes('head')) {
              model.motion('tap_body')
            }
          })

          // 自动随机动作
          if (autoMotion) {
            motionIntervalRef.current = setInterval(() => {
              if (!cancelled && modelRef.current && !(modelRef.current as any)._destroyed) {
                try {
                  modelRef.current.motion('tap_body')
                } catch {
                  // 忽略
                }
              }
            }, 10000 + Math.random() * 15000) // 每 10-25 秒
          }
        } catch (error) {
          console.error('Failed to load Live2D model:', error)
        }
      }

      init()

      return () => {
        cancelled = true

        if (motionIntervalRef.current) {
          clearInterval(motionIntervalRef.current)
          motionIntervalRef.current = null
        }

        if (modelRef.current) {
          try { modelRef.current.destroy() } catch { /* ignore */ }
          modelRef.current = null
        }

        if (appRef.current) {
          try {
            appRef.current.destroy(true, { children: true })
          } catch { /* ignore */ }
          appRef.current = null
        }

        if (containerRef.current) {
          containerRef.current.innerHTML = ''
        }
      }
    // stable deps — only reload on modelUrl change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modelUrl, width, height])

    return (
      <div
        ref={containerRef}
        className="live2d-canvas"
        style={{
          width,
          height,
          maxWidth: '100%',
          margin: '0 auto',
        }}
        role="img"
        aria-label="Live2D 角色"
      />
    )
  }
)

export default Live2DCanvas
