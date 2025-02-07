"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { io, type Socket } from "socket.io-client"
import { useSession } from "next-auth/react"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  currentCity: string | null
  reconnect: () => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  currentCity: null,
  reconnect: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentCity, setCurrentCity] = useState<string | null>(null)
  const { data: session, status } = useSession()

  const initializeSocket = useCallback(() => {
    if (socket) {
      socket.close()
    }

    console.log("Initializing socket connection...")
    const socketInstance = io(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000", {
      path: "/api/socket",
      addTrailingSlash: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    })

    socketInstance.on("connect", () => {
      console.log("Socket connected successfully")
      setIsConnected(true)
    })

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
      setIsConnected(false)
    })

    socketInstance.on("disconnect", (reason) => {
      console.log("Socket disconnected. Reason:", reason)
      setIsConnected(false)
    })

    setSocket(socketInstance)
  }, [socket])

  // Initialize socket when component mounts
  useEffect(() => {
    initializeSocket()

    return () => {
      if (socket) {
        console.log("Cleaning up socket connection...")
        socket.close()
      }
    }
  }, [initializeSocket]) // Added initializeSocket to dependency array

  // Auto-join city room when session is available
  useEffect(() => {
    if (!socket || !session?.user?.email || status !== "authenticated") {
      console.log("Waiting for socket connection and session...", {
        socket: !!socket,
        session: !!session,
        status,
      })
      return
    }

    async function joinUserCity() {
      try {
        console.log("Fetching user city...")
        const response = await fetch("/api/user/city")
        if (!response.ok) {
          throw new Error(`Failed to fetch city: ${response.status}`)
        }
        const data = await response.json()

        console.log("Received city data:", data)

        if (data.city && socket) {
          socket.emit("join-city", data.city)
          setCurrentCity(data.city)
          console.log("Joined city room:", data.city)
        } else {
          console.log("No city found in response:", data)
          setCurrentCity(null)
        }
      } catch (error) {
        console.error("Failed to join city room:", error)
        setCurrentCity(null)
      }
    }

    joinUserCity()
  }, [socket, session, status])

  return (
    <SocketContext.Provider value={{ socket, isConnected, currentCity, reconnect: initializeSocket }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

