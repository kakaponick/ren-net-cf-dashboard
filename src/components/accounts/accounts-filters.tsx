import { Cloud, Globe, Server, Terminal, Search, X, ArrowRightLeft, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ButtonGroup } from "@/components/ui/button-group"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import type { AccountCategory } from "@/types/cloudflare"

interface AccountsFiltersProps {
  categoryFilter: AccountCategory | "all"
  setCategoryFilter: (category: AccountCategory | "all") => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  filteredCount?: number
  totalCount?: number
}

export function AccountsFilters({
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  clearSearch,
  filteredCount,
  totalCount,
}: AccountsFiltersProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              <PlusCircle className="mr-2 h-4 w-4" />
              {{
                "all": "All Categories",
                "cloudflare": "Cloudflare",
                "registrar": "Domain Registrars",
                "vps": "Server Registrars",
                "proxy": "Proxy",
                "ssh": "SSH",
                "npm": "NPM",
              }[categoryFilter] || "Filter"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={categoryFilter === "all"}
              onCheckedChange={() => setCategoryFilter("all")}
            >
              All Categories
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={categoryFilter === "cloudflare"}
              onCheckedChange={() => setCategoryFilter("cloudflare")}
            >
              <Cloud className="mr-2 h-4 w-4" />
              Cloudflare
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={categoryFilter === "registrar"}
              onCheckedChange={() => setCategoryFilter("registrar")}
            >
              <Globe className="mr-2 h-4 w-4" />
              Domain Registrars
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={categoryFilter === "vps"}
              onCheckedChange={() => setCategoryFilter("vps")}
            >
              <Server className="mr-2 h-4 w-4" />
              Server Registrars
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={categoryFilter === "proxy"}
              onCheckedChange={() => setCategoryFilter("proxy")}
            >
              <Server className="mr-2 h-4 w-4" />
              Proxy
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={categoryFilter === "ssh"}
              onCheckedChange={() => setCategoryFilter("ssh")}
            >
              <Terminal className="mr-2 h-4 w-4" />
              SSH
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={categoryFilter === "npm"}
              onCheckedChange={() => setCategoryFilter("npm")}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              NPM
            </DropdownMenuCheckboxItem>

          </DropdownMenuContent>
        </DropdownMenu>
        {filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount && (
          <Badge variant="secondary">
            {filteredCount} of {totalCount}
          </Badge>
        )}
      </div>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search credentials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-muted"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
