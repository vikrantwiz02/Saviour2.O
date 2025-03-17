"use client"

import { createContext, useContext } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { adminSidebarItems } from "@/lib/adminSidebarItems"

interface AdminSidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
}

const AdminSidebarContext = createContext<AdminSidebarContextType | undefined>(undefined)

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext)
  if (context === undefined) {
    throw new Error("useAdminSidebar must be used within an AdminSidebarProvider")
  }
  return context
}

interface AdminSidebarProps {
  onLinkClick?: (href: string) => void
  isMobile?: boolean
}

export function AdminSidebar({ onLinkClick, isMobile = false }: AdminSidebarProps) {
  const pathname = usePathname()

  const handleLinkClick = (href: string) => {
    if (onLinkClick) {
      onLinkClick(href)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-white dark:bg-gray-900 border-r transition-all duration-300",
        isMobile ? "w-full" : "w-64",
      )}
    >
      <ScrollArea className="flex-1">
        <nav className="space-y-1 px-2 py-4">
          {adminSidebarItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => handleLinkClick(item.href)}>
              <Button variant={pathname === item.href ? "secondary" : "ghost"} className="w-full justify-start px-4">
                <item.icon className="h-5 w-5 mr-2" />
                <span>{item.name}</span>
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}

