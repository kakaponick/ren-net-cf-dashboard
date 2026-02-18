import * as React from "react"
import { Check, ChevronsUpDown, Plus, Server } from "lucide-react"
import { AddCredentialsDialog } from "@/components/accounts/add-credentials-dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAccountStore } from "@/store/account-store"

interface VPSIPComboboxProps extends Omit<React.ComponentProps<typeof Button>, "onChange" | "value"> {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function VPSIPCombobox({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select IP...",
  ...props
}: VPSIPComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const { vpsAccounts, loadVPSAccounts } = useAccountStore()

  React.useEffect(() => {
    loadVPSAccounts()
  }, [])

  const handleSelect = (currentValue: string) => {
    onChange(currentValue)
    setOpen(false)
  }

  const handleCustomValue = () => {
    if (inputValue) {
      onChange(inputValue)
      setOpen(false)
    }
  }

  const selectedVPS = vpsAccounts.find((account) => account.ip === value)

  const [showAddServerDialog, setShowAddServerDialog] = React.useState(false)

  // Filter vps accounts based on input if needed, but CommandList handles filtering usually.
  // However, for custom values, we want to know if it's unique.

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", className)}
            disabled={disabled}
            {...props}
          >
            {value ? (
              <div className="flex items-center truncate">
                {selectedVPS ? (
                  <>
                    <Server className="mr-2 h-4 w-4 opacity-50" />
                    <span className="truncate">{selectedVPS.ip}</span>
                  </>
                ) : (
                  <span className="truncate">{value}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-h-[var(--radix-popover-content-available-height)] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput
              placeholder="Search Server or enter IP..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-sm text-center">
                  <p className="text-muted-foreground mb-2">No Server found.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-2"
                    onClick={() => {
                      setOpen(false)
                      setShowAddServerDialog(true)
                    }}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Add New Server
                  </Button>
                  {inputValue && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={handleCustomValue}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Use "{inputValue}"
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setShowAddServerDialog(true)
                  }}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Server
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Server Registrars">
                {vpsAccounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.ip + " " + account.name} // Include name in value for search matching
                    onSelect={() => handleSelect(account.ip)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === account.ip ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{account.ip}</span>
                      <span className="text-xs text-muted-foreground">{account.name}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue && !vpsAccounts.some(v => v.ip === inputValue) && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Custom">
                    <CommandItem onSelect={handleCustomValue} value={inputValue}>
                      <Plus className="mr-2 h-4 w-4" />
                      Use "{inputValue}"
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <AddCredentialsDialog
        open={showAddServerDialog}
        onOpenChange={setShowAddServerDialog}
        initialCategory="vps"
        initialMode="single"
      />
    </>
  )
}
