"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Volume2, VolumeX, Trophy, Coins, Zap, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"

type GameState = "start" | "playing" | "gameOver"

interface GameObject {
  x: number
  y: number
  width: number
  height: number
}

interface Player extends GameObject {
  dx: number
  dy: number
}

interface Coin extends GameObject {
  collected: boolean
  id: number
}

interface Obstacle extends GameObject {
  dx: number
  id: number
}

interface Particle {
  x: number
  y: number
  dx: number
  dy: number
  life: number
  maxLife: number
  color: string
}

export default function MiniAdventureGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const keysRef = useRef<Set<string>>(new Set())
  const touchKeysRef = useRef<Set<string>>(new Set())
  const lastCoinSpawnRef = useRef<number>(0)
  const lastObstacleSpawnRef = useRef<number>(0)
  const coinIdRef = useRef<number>(0)
  const obstacleIdRef = useRef<number>(0)
  const gameStartTimeRef = useRef<number>(0)

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null)
  const coinSoundRef = useRef<HTMLAudioElement | null>(null)
  const jumpSoundRef = useRef<HTMLAudioElement | null>(null)
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null)

  const [gameState, setGameState] = useState<GameState>("start")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [gameTime, setGameTime] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // Game objects
  const [player, setPlayer] = useState<Player>({
    x: 50,
    y: 300,
    width: 30,
    height: 30,
    dx: 0,
    dy: 0,
  })

  const [coins, setCoins] = useState<Coin[]>([])
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [particles, setParticles] = useState<Particle[]>([])

  // Game constants
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 400
  const GRAVITY = 0.5
  const JUMP_FORCE = -12
  const PLAYER_SPEED = 5
  const GROUND_LEVEL = CANVAS_HEIGHT - 50
  const COIN_SPAWN_INTERVAL = 2000 // 2 seconds
  const COIN_SIZE = 20
  const OBSTACLE_BASE_SPEED = 3
  const OBSTACLE_SPAWN_INTERVAL = 3000 // 3 seconds initially

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    // Create audio context for better browser compatibility
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContext) {
      const audioContext = new AudioContext()

      // Resume audio context on user interaction
      const resumeAudio = () => {
        if (audioContext.state === "suspended") {
          audioContext.resume()
        }
      }

      document.addEventListener("click", resumeAudio, { once: true })
      document.addEventListener("keydown", resumeAudio, { once: true })
      document.addEventListener("touchstart", resumeAudio, { once: true })
    }

    // Load mute preference
    const savedMuteState = localStorage.getItem("miniAdventureMuted")
    if (savedMuteState) {
      setIsMuted(JSON.parse(savedMuteState))
    }
  }, [])

  const playSound = useCallback(
    (audioRef: React.RefObject<HTMLAudioElement>) => {
      if (!isMuted && audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {
          // Ignore audio play errors (common in browsers with strict audio policies)
        })
      }
    },
    [isMuted],
  )

  const toggleMute = useCallback(() => {
    const newMuteState = !isMuted
    setIsMuted(newMuteState)
    localStorage.setItem("miniAdventureMuted", JSON.stringify(newMuteState))

    if (backgroundMusicRef.current) {
      if (newMuteState) {
        backgroundMusicRef.current.pause()
      } else if (gameState === "playing") {
        backgroundMusicRef.current.play().catch(() => {})
      }
    }
  }, [isMuted, gameState])

  const getActiveKeys = useCallback(() => {
    const allKeys = new Set([...keysRef.current, ...touchKeysRef.current])
    return allKeys
  }, [])

  const handleTouchControl = useCallback((action: string, pressed: boolean) => {
    if (pressed) {
      touchKeysRef.current.add(action)
    } else {
      touchKeysRef.current.delete(action)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) {
        e.preventDefault()
        keysRef.current.add(key)

        if ((key === "arrowup" || key === "w" || key === " ") && gameState === "playing") {
          const isOnGround = player.y >= GROUND_LEVEL - player.height
          if (isOnGround) {
            playSound(jumpSoundRef)
          }
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.delete(key)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState, player.y, playSound])

  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem("miniAdventureHighScore")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }
  }, [])

  // Save high score to localStorage
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem("miniAdventureHighScore", score.toString())
    }
  }, [score, highScore])

  useEffect(() => {
    if (gameState === "playing") {
      const interval = setInterval(() => {
        setGameTime(Math.floor((Date.now() - gameStartTimeRef.current) / 1000))
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [gameState])

  const createParticles = useCallback((x: number, y: number, color: string, count = 5) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: x + Math.random() * 20 - 10,
        y: y + Math.random() * 20 - 10,
        dx: (Math.random() - 0.5) * 4,
        dy: (Math.random() - 0.5) * 4 - 2,
        life: 30,
        maxLife: 30,
        color,
      })
    }
    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  const updateParticles = useCallback(() => {
    setParticles((prev) =>
      prev
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.dx,
          y: particle.y + particle.dy,
          dy: particle.dy + 0.1, // gravity
          life: particle.life - 1,
        }))
        .filter((particle) => particle.life > 0),
    )
  }, [])

  const spawnCoin = useCallback(() => {
    const newCoin: Coin = {
      id: coinIdRef.current++,
      x: Math.random() * (CANVAS_WIDTH - COIN_SIZE),
      y: Math.random() * (GROUND_LEVEL - COIN_SIZE - 100) + 50, // Spawn above ground with some margin
      width: COIN_SIZE,
      height: COIN_SIZE,
      collected: false,
    }
    setCoins((prev) => [...prev, newCoin])
  }, [])

  const spawnObstacle = useCallback(() => {
    const currentTime = Date.now()
    const gameTime = currentTime - gameStartTimeRef.current
    const difficultyMultiplier = Math.min(1 + gameTime / 30000, 2.5) // Increase difficulty over 30 seconds, max 2.5x

    const obstacleTypes = [
      { width: 30, height: 40, speed: OBSTACLE_BASE_SPEED * difficultyMultiplier },
      { width: 20, height: 60, speed: OBSTACLE_BASE_SPEED * difficultyMultiplier * 1.2 },
      { width: 40, height: 30, speed: OBSTACLE_BASE_SPEED * difficultyMultiplier * 0.8 },
    ]

    const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)]

    const newObstacle: Obstacle = {
      id: obstacleIdRef.current++,
      x: CANVAS_WIDTH,
      y: GROUND_LEVEL - obstacleType.height,
      width: obstacleType.width,
      height: obstacleType.height,
      dx: -obstacleType.speed,
    }
    setObstacles((prev) => [...prev, newObstacle])
  }, [])

  const checkCollision = useCallback((rect1: GameObject, rect2: GameObject): boolean => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    )
  }, [])

  const collectCoins = useCallback(
    (currentPlayer: Player) => {
      setCoins((prevCoins) => {
        const updatedCoins = prevCoins.map((coin) => {
          if (!coin.collected && checkCollision(currentPlayer, coin)) {
            setScore((prevScore) => prevScore + 10)
            playSound(coinSoundRef)
            createParticles(coin.x + coin.width / 2, coin.y + coin.height / 2, "#f59e0b", 8)
            return { ...coin, collected: true }
          }
          return coin
        })

        // Remove collected coins after a short delay for visual feedback
        return updatedCoins.filter((coin) => !coin.collected)
      })
    },
    [checkCollision, playSound, createParticles],
  )

  const checkObstacleCollisions = useCallback(
    (currentPlayer: Player) => {
      for (const obstacle of obstacles) {
        if (checkCollision(currentPlayer, obstacle)) {
          playSound(gameOverSoundRef)
          createParticles(
            currentPlayer.x + currentPlayer.width / 2,
            currentPlayer.y + currentPlayer.height / 2,
            "#dc2626",
            12,
          )
          gameOver()
          return true
        }
      }
      return false
    },
    [obstacles, checkCollision, playSound, createParticles],
  )

  const updateObstacles = useCallback(() => {
    setObstacles((prevObstacles) => {
      return prevObstacles
        .map((obstacle) => ({
          ...obstacle,
          x: obstacle.x + obstacle.dx,
        }))
        .filter((obstacle) => obstacle.x + obstacle.width > 0) // Remove obstacles that have moved off screen
    })
  }, [])

  // Initialize game
  const initGame = useCallback(() => {
    setPlayer({
      x: 50,
      y: GROUND_LEVEL - 30,
      width: 30,
      height: 30,
      dx: 0,
      dy: 0,
    })
    setCoins([])
    setObstacles([])
    setParticles([])
    setScore(0)
    setGameTime(0)
    lastCoinSpawnRef.current = 0
    lastObstacleSpawnRef.current = 0
    coinIdRef.current = 0
    obstacleIdRef.current = 0
    gameStartTimeRef.current = Date.now()
    touchKeysRef.current.clear()
  }, [])

  // Start game
  const startGame = () => {
    initGame()
    setGameState("playing")

    if (!isMuted && backgroundMusicRef.current) {
      backgroundMusicRef.current.play().catch(() => {})
    }
  }

  // Game over
  const gameOver = () => {
    setGameState("gameOver")
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause()
      backgroundMusicRef.current.currentTime = 0
    }
  }

  // Restart game
  const restartGame = () => {
    startGame()
  }

  const updatePlayer = useCallback(
    (currentPlayer: Player) => {
      const newPlayer = { ...currentPlayer }
      const keys = getActiveKeys()

      // Handle horizontal movement
      newPlayer.dx = 0
      if (keys.has("arrowleft") || keys.has("a") || keys.has("left")) {
        newPlayer.dx = -PLAYER_SPEED
      }
      if (keys.has("arrowright") || keys.has("d") || keys.has("right")) {
        newPlayer.dx = PLAYER_SPEED
      }

      // Handle jumping
      const isOnGround = newPlayer.y >= GROUND_LEVEL - newPlayer.height
      if ((keys.has("arrowup") || keys.has("w") || keys.has(" ") || keys.has("jump")) && isOnGround) {
        newPlayer.dy = JUMP_FORCE
      }

      // Apply gravity
      if (!isOnGround) {
        newPlayer.dy += GRAVITY
      }

      // Update position
      newPlayer.x += newPlayer.dx
      newPlayer.y += newPlayer.dy

      // Keep player within canvas bounds
      if (newPlayer.x < 0) {
        newPlayer.x = 0
      }
      if (newPlayer.x + newPlayer.width > CANVAS_WIDTH) {
        newPlayer.x = CANVAS_WIDTH - newPlayer.width
      }

      // Ground collision
      if (newPlayer.y >= GROUND_LEVEL - newPlayer.height) {
        newPlayer.y = GROUND_LEVEL - newPlayer.height
        newPlayer.dy = 0
      }

      // Prevent going above canvas
      if (newPlayer.y < 0) {
        newPlayer.y = 0
        newPlayer.dy = 0
      }

      return newPlayer
    },
    [getActiveKeys],
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw ground with pattern
    ctx.fillStyle = "#fefce8"
    ctx.fillRect(0, GROUND_LEVEL, CANVAS_WIDTH, 50)

    // Add ground texture
    ctx.fillStyle = "#f3f4f6"
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.fillRect(i, GROUND_LEVEL + 40, 20, 10)
    }

    // Draw player with bounce animation
    const bounceOffset = Math.sin(Date.now() * 0.01) * 2
    ctx.fillStyle = "#d97706"
    ctx.fillRect(player.x, player.y + bounceOffset, player.width, player.height)

    // Add simple eyes to make it look more like a character
    ctx.fillStyle = "#374151"
    ctx.fillRect(player.x + 8, player.y + 8 + bounceOffset, 4, 4)
    ctx.fillRect(player.x + 18, player.y + 8 + bounceOffset, 4, 4)

    // Draw coins with rotation animation
    const time = Date.now() * 0.005
    coins.forEach((coin) => {
      if (!coin.collected) {
        const centerX = coin.x + coin.width / 2
        const centerY = coin.y + coin.height / 2
        const rotation = time + coin.id * 0.5

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(rotation)

        // Draw glow effect
        ctx.shadowColor = "#f59e0b"
        ctx.shadowBlur = 15
        ctx.fillStyle = "#f59e0b"
        ctx.beginPath()
        ctx.arc(0, 0, coin.width / 2, 0, Math.PI * 2)
        ctx.fill()

        // Draw inner highlight
        ctx.shadowBlur = 0
        ctx.fillStyle = "#fbbf24"
        ctx.beginPath()
        ctx.arc(0, 0, coin.width / 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }
    })

    // Reset shadow for other elements
    ctx.shadowBlur = 0

    obstacles.forEach((obstacle) => {
      // Draw main obstacle body
      ctx.fillStyle = "#dc2626"
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height)

      // Draw spikes on top for visual danger
      ctx.fillStyle = "#991b1b"
      const spikeCount = Math.floor(obstacle.width / 8)
      for (let i = 0; i < spikeCount; i++) {
        const spikeX = obstacle.x + (i * obstacle.width) / spikeCount
        const spikeWidth = obstacle.width / spikeCount
        ctx.beginPath()
        ctx.moveTo(spikeX, obstacle.y)
        ctx.lineTo(spikeX + spikeWidth / 2, obstacle.y - 8)
        ctx.lineTo(spikeX + spikeWidth, obstacle.y)
        ctx.closePath()
        ctx.fill()
      }

      // Add warning glow effect
      ctx.shadowColor = "#dc2626"
      ctx.shadowBlur = 5
      ctx.fillStyle = "#fca5a5"
      ctx.fillRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, obstacle.height - 4)
      ctx.shadowBlur = 0
    })

    // Draw particles
    particles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = particle.color
      ctx.fillRect(particle.x, particle.y, 3, 3)
    })
    ctx.globalAlpha = 1
  }, [player, coins, obstacles, particles])

  const gameLoop = useCallback(() => {
    if (gameState !== "playing") return

    const currentTime = Date.now()
    const gameTime = currentTime - gameStartTimeRef.current

    // Dynamic obstacle spawn interval based on difficulty
    const currentObstacleInterval = Math.max(OBSTACLE_SPAWN_INTERVAL - gameTime / 100, 1500) // Minimum 1.5 seconds

    // Spawn coins at regular intervals
    if (currentTime - lastCoinSpawnRef.current > COIN_SPAWN_INTERVAL) {
      spawnCoin()
      lastCoinSpawnRef.current = currentTime
    }

    // Spawn obstacles at increasing frequency
    if (currentTime - lastObstacleSpawnRef.current > currentObstacleInterval) {
      spawnObstacle()
      lastObstacleSpawnRef.current = currentTime
    }

    // Update obstacles and particles
    updateObstacles()
    updateParticles()

    // Update player
    setPlayer((currentPlayer) => {
      const updatedPlayer = updatePlayer(currentPlayer)

      // Check for obstacle collisions (game over)
      if (checkObstacleCollisions(updatedPlayer)) {
        return updatedPlayer
      }

      // Collect coins
      collectCoins(updatedPlayer)
      return updatedPlayer
    })

    render()
    animationRef.current = requestAnimationFrame(gameLoop)
  }, [
    gameState,
    render,
    updatePlayer,
    spawnCoin,
    spawnObstacle,
    updateObstacles,
    updateParticles,
    collectCoins,
    checkObstacleCollisions,
  ])

  // Start game loop when playing
  useEffect(() => {
    if (gameState === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState, gameLoop])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-2 sm:p-4">
      <audio ref={backgroundMusicRef} loop>
        <source src="/placeholder.mp3?query=upbeat retro arcade background music" type="audio/mpeg" />
      </audio>
      <audio ref={coinSoundRef}>
        <source src="/placeholder.mp3?query=coin collection sound effect" type="audio/mpeg" />
      </audio>
      <audio ref={jumpSoundRef}>
        <source src="/placeholder.mp3?query=jump sound effect" type="audio/mpeg" />
      </audio>
      <audio ref={gameOverSoundRef}>
        <source src="/placeholder.mp3?query=game over sound effect" type="audio/mpeg" />
      </audio>

      <div className="w-full max-w-4xl">
        {gameState === "playing" && (
          <Card className="mb-2 sm:mb-4 p-2 sm:p-4 bg-gradient-to-r from-card to-muted/50 border-2 border-primary/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-sm sm:text-lg font-bold text-foreground">Score: {score}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
                  <span className="text-xs sm:text-sm text-muted-foreground">Time: {gameTime}s</span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
                  <span className="text-xs sm:text-sm text-muted-foreground">Best: {highScore}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={toggleMute} className="p-1 sm:p-2">
                  {isMuted ? (
                    <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Game Canvas */}
        <div className="relative bg-card border-2 border-border rounded-lg overflow-hidden shadow-lg">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full h-auto max-w-full touch-none"
            style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
          />

          {gameState === "start" && (
            <div className="absolute inset-0 bg-gradient-to-br from-background/95 to-primary/10 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="text-center space-y-4 sm:space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 px-4">
                <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Mini Adventure
                </h1>
                <p className="text-lg sm:text-xl text-primary font-semibold">Game</p>
                <div className="max-w-md mx-auto space-y-3 sm:space-y-4">
                  <p className="text-sm sm:text-base text-muted-foreground text-center leading-relaxed">
                    Collect glowing coins and avoid dangerous obstacles!{" "}
                    {isMobile ? "Use the touch controls below." : "Use arrow keys, WASD, or spacebar to move and jump."}
                  </p>
                  <div className="flex justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                      <span>+10 points</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-destructive rounded-sm"></div>
                      <span>Avoid!</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={startGame}
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200"
                >
                  Start Adventure
                </Button>
                <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
                  <Button variant="ghost" size="sm" onClick={toggleMute} className="p-2">
                    {isMuted ? (
                      <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">Sound {isMuted ? "Off" : "On"}</span>
                </div>
              </div>
            </div>
          )}

          {gameState === "gameOver" && (
            <div className="absolute inset-0 bg-gradient-to-br from-background/95 to-destructive/10 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="text-center space-y-4 sm:space-y-6 animate-in fade-in-0 slide-in-from-top-4 duration-700 px-4">
                <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">Game Over!</h2>
                <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-border/50">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      <p className="text-lg sm:text-2xl font-bold text-foreground">Final Score: {score}</p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                      <p className="text-sm sm:text-lg text-muted-foreground">Survived: {gameTime} seconds</p>
                    </div>
                    {score === highScore && score > 0 && (
                      <div className="flex items-center justify-center gap-2 animate-pulse">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                        <p className="text-sm sm:text-lg font-bold text-secondary">New High Score!</p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={restartGame}
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200"
                >
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Touch Controls */}
        {isMobile && gameState === "playing" && (
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-16 h-16 rounded-full bg-card/80 backdrop-blur-sm border-2 active:scale-95 transition-transform"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    handleTouchControl("left", true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    handleTouchControl("left", false)
                  }}
                  onMouseDown={() => handleTouchControl("left", true)}
                  onMouseUp={() => handleTouchControl("left", false)}
                  onMouseLeave={() => handleTouchControl("left", false)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-16 h-16 rounded-full bg-card/80 backdrop-blur-sm border-2 active:scale-95 transition-transform"
                  onTouchStart={(e) => {
                    e.preventDefault()
                    handleTouchControl("right", true)
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    handleTouchControl("right", false)
                  }}
                  onMouseDown={() => handleTouchControl("right", true)}
                  onMouseUp={() => handleTouchControl("right", false)}
                  onMouseLeave={() => handleTouchControl("right", false)}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="lg"
                className="w-20 h-16 rounded-full bg-primary/20 backdrop-blur-sm border-2 border-primary active:scale-95 transition-transform"
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleTouchControl("jump", true)
                  const isOnGround = player.y >= GROUND_LEVEL - player.height
                  if (isOnGround) {
                    playSound(jumpSoundRef)
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  handleTouchControl("jump", false)
                }}
                onMouseDown={() => {
                  handleTouchControl("jump", true)
                  const isOnGround = player.y >= GROUND_LEVEL - player.height
                  if (isOnGround) {
                    playSound(jumpSoundRef)
                  }
                }}
                onMouseUp={() => handleTouchControl("jump", false)}
                onMouseLeave={() => handleTouchControl("jump", false)}
              >
                <ChevronUp className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {gameState === "playing" && (
          <Card className="mt-2 sm:mt-4 p-2 sm:p-4 bg-muted/30 border-dashed">
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              {!isMobile && (
                <div className="flex items-center gap-1">
                  <kbd className="px-1 sm:px-2 py-1 bg-background border rounded text-xs">↑</kbd>
                  <kbd className="px-1 sm:px-2 py-1 bg-background border rounded text-xs">WASD</kbd>
                  <kbd className="px-1 sm:px-2 py-1 bg-background border rounded text-xs">Space</kbd>
                  <span>Move & Jump</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span>Collect coins (+10 points)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-destructive rounded-sm"></div>
                <span>Avoid red obstacles</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
