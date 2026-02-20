"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
]

const SCROLL_THRESHOLD = 12
const DEBOUNCE_MS = 0

export function Navbar() {
  const pathname = usePathname()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [sliderStyle, setSliderStyle] = useState<{ left: number; width: number } | null>(null)
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [visible, setVisible] = useState(true)
  const [atTop, setAtTop] = useState(true)
  const lastScrollY = useRef(0)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const currentY = window.scrollY
      const isAtTop = currentY <= 0

      setAtTop(isAtTop)

      if (isAtTop) {
        setVisible(true)
      } else {
        const delta = currentY - lastScrollY.current
        if (delta > SCROLL_THRESHOLD) {
          setVisible(false)
        } else if (delta < -SCROLL_THRESHOLD) {
          setVisible(true)
        }
      }

      lastScrollY.current = currentY
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [handleScroll])

  // Reset visibility on route change
  useEffect(() => {
    setVisible(true)
    setAtTop(window.scrollY <= 0)
    lastScrollY.current = window.scrollY
  }, [pathname])

  const activeIndex = NAV_ITEMS.findIndex(
    (item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  )
  const targetIndex = hoveredIndex ?? activeIndex

  useEffect(() => {
    const el = navRefs.current[targetIndex]
    if (el) {
      const { offsetLeft, offsetWidth } = el
      setSliderStyle({ left: offsetLeft, width: offsetWidth })
    } else {
      setSliderStyle(null)
    }
  }, [targetIndex])

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-150 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
      )}
    >
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-5 py-3",
          )}
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.03)",
          }}
        >
          {/* Logo + Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-[38px] w-[38px] max-h-[42px] overflow-hidden rounded-lg">
              <Image
                src="/fingraphix-logo.jpg"
                alt="FinGraphix logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span
              className="text-lg font-semibold tracking-tight transition-colors text-foreground"
            >
              FinGraphix
            </span>
          </Link>

          {/* Navigation Links with Animated Pill Slider */}
          <div
            className="relative flex items-center gap-1"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Animated pill slider background */}
            {sliderStyle && (
              <div
                className="absolute top-0 h-full transition-all ease-in-out"
                style={{
                  left: sliderStyle.left,
                  width: sliderStyle.width,
                  background: "rgba(255,255,255,0.15)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  borderRadius: "999px",
                  transitionDuration: "300ms",
                }}
              />
            )}

            {NAV_ITEMS.map((item, i) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  ref={(el) => { navRefs.current[i] = el }}
                  href={item.href}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className={cn(
                    "relative z-10 px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  style={{
                    borderRadius: "999px",
                  }}
                  data-active={isActive ? "" : undefined}
                  onFocus={() => setHoveredIndex(i)}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
