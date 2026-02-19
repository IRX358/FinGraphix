"use client"

import { useEffect, useRef, useState } from "react"

interface ScrollRevealOptions {
  threshold?: number
  delay?: number
  once?: boolean
}

export function useScrollReveal<T extends HTMLElement>({
  threshold = 0.15,
  delay = 0,
  once = true,
}: ScrollRevealOptions = {}) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => setIsVisible(true), delay)
          } else {
            setIsVisible(true)
          }
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, delay, once])

  return { ref, isVisible }
}
