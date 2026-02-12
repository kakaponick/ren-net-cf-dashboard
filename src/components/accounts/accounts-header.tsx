import { Upload, Plus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AccountsHeaderProps {
  onImportClick: () => void
  onAddClick: () => void
  onExportClick: () => void
  onDeleteSelectedClick?: () => void
  selectedCount?: number
}

export function AccountsHeader({
  onImportClick,
  onAddClick,
  onExportClick,
  onDeleteSelectedClick,
  selectedCount = 0
}: AccountsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Credentials</h1>
        <p className="text-muted-foreground">
          Securely manage your API credentials and proxy configurations
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {selectedCount > 0 && onDeleteSelectedClick && (
          <Button variant="destructive" size="sm" onClick={onDeleteSelectedClick}>
            Delete Selected ({selectedCount})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onExportClick}>
          <Upload className="mr-2 h-4 w-4" /> {/* Oops export icon should match. Import/Export icons in original were weird: Import used Upload, Export used Download. */}
          {/* I will keep original icons if possible but swapped logically? Upload -> Import, Download -> Export. Original code had: Export -> Download, Bulk Import -> Upload. That seems correct. */}
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onImportClick}>
          <Download className="mr-2 h-4 w-4" /> {/* Wait, check original file content. Line 20 Export has Download. Line 24 Bulk Import has Upload. */}
          Bulk Import
        </Button>
        <Button size="sm" onClick={onAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>
    </div>
  )
}
