import { Cloud, Globe, Server, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ButtonGroup } from "@/components/ui/button-group"
import { Badge } from "@/components/ui/badge"
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
        <ButtonGroup>
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
        >
          All
        </Button>
        <Button
          variant={categoryFilter === "cloudflare" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("cloudflare")}
        >
          <Cloud className="mr-1.5 h-3.5 w-3.5" />
          Cloudflare
        </Button>
        <Button
          variant={categoryFilter === "registrar" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("registrar")}
        >
          <Globe className="mr-1.5 h-3.5 w-3.5" />
          Registrar
        </Button>
        <Button
          variant={categoryFilter === "proxy" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("proxy")}
        >
          <Server className="mr-1.5 h-3.5 w-3.5" />
          Proxy
        </Button>
      </ButtonGroup>
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
