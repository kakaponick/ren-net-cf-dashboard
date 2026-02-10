import { useState } from "react"
import {
  User, Plus, Eye, EyeOff, Pencil, Trash2, Copy, Check,
  ArrowUpDown, ArrowUp, ArrowDown, Cloud, Globe, Server, Terminal,
  ArrowRightLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import type { CloudflareAccount, ProxyAccount, SSHAccount, VPSAccount, AccountCategory } from "@/types/cloudflare"
import { AccountsFilters } from "./accounts-filters"
import type { SortField, SortDirection } from "@/hooks/use-accounts-view"
import { getCategoryColorClasses, getCategoryLabel } from "@/lib/utils"

interface AccountsTableProps {
  accounts: (CloudflareAccount | ProxyAccount | SSHAccount | VPSAccount)[]
  totalCount: number
  filteredCount: number

  // Filter props
  filterProps: any // Passing through props for AccountsFilters

  // Sorting props
  sortField: SortField
  sortDirection: SortDirection
  onToggleSort: (field: SortField) => void

  // Actions
  onAddClick: (category?: AccountCategory) => void
  onEditClick: (account: CloudflareAccount | ProxyAccount | SSHAccount | VPSAccount) => void
  onDeleteClick: (id: string) => void
}

export function AccountsTable({
  accounts,
  totalCount,
  filteredCount,
  filterProps,
  sortField,
  sortDirection,
  onToggleSort,
  onAddClick,
  onEditClick,
  onDeleteClick
}: AccountsTableProps) {
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 text-muted-foreground" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-muted-foreground" />
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <AccountsFilters {...filterProps} filteredCount={filteredCount} totalCount={totalCount} />
      </CardHeader>

      <CardContent>
        {filteredCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {filterProps.searchQuery ? 'No credentials found' : 'No credentials added yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {filterProps.searchQuery
                ? `No credentials match "${filterProps.searchQuery}". Try adjusting your search terms.`
                : 'Get started by adding your first account or proxy configuration.'
              }
            </p>
            {filterProps.searchQuery ? (
              <Button variant="outline" onClick={filterProps.clearSearch}>
                Clear search
              </Button>
            ) : (
              <Button onClick={() => onAddClick(filterProps.categoryFilter !== 'all' ? (filterProps.categoryFilter as AccountCategory) : undefined)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Account
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted/50">
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[300px]">
                    <Button
                      variant="ghost"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => onToggleSort("email")}
                    >
                      Name/Email
                      <SortIcon field="email" />
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[300px]">Credentials</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const accountId = account.id
                  const isProxy = account.category === 'proxy'
                  const isSSH = account.category === 'ssh'
                  const isVPS = account.category === 'vps'

                  const emailOrName = isVPS
                    ? (account as VPSAccount).name
                    : isSSH
                      ? (account as SSHAccount).name
                      : isProxy
                        ? (account as ProxyAccount).name || `${(account as ProxyAccount).host}:${(account as ProxyAccount).port}`
                        : (account as CloudflareAccount).email

                  const apiToken = isVPS
                    ? `${(account as VPSAccount).ip}${(account as VPSAccount).expirationDate ? ` (Exp: ${(account as VPSAccount).expirationDate})` : ''}`
                    : isSSH
                      ? `${(account as SSHAccount).host}:${(account as SSHAccount).port}:${(account as SSHAccount).username}`
                      : isProxy
                        ? `${(account as ProxyAccount).host}:${(account as ProxyAccount).port}${(account as ProxyAccount).username ? `:${(account as ProxyAccount).username}` : ''}${(account as ProxyAccount).password ? `:${(account as ProxyAccount).password}` : ''}`
                        : (account as CloudflareAccount).apiToken

                  const displayToken = isVPS
                    ? apiToken
                    : isSSH
                      ? `${(account as SSHAccount).username}@${(account as SSHAccount).host}:${(account as SSHAccount).port}••••••••••••`
                      : isProxy
                        ? `${(account as ProxyAccount).host}:${(account as ProxyAccount).port}••••••••••••`
                        : `${apiToken.substring(0, 12)}••••••••••••`

                  return (
                    <TableRow key={accountId} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge
                          variant="outline"
                        >
                          <div className="flex items-center gap-1">
                            {(() => {
                              const category = account.category || 'cloudflare';
                              const iconClass = `h-3 w-3 ${getCategoryColorClasses(category).icon}`;

                              // Render icon based on category
                              const renderIcon = () => {
                                switch (category) {
                                  case 'cloudflare':
                                    return <Cloud className={iconClass} />;
                                  case 'registrar':
                                    return <Globe className={iconClass} />;
                                  case 'proxy':
                                    return <Server className={iconClass} />;
                                  case 'ssh':
                                    return <Terminal className={iconClass} />;
                                  case 'vps':
                                    return <Server className={iconClass} />;
                                  case 'npm':
                                    return <ArrowRightLeft className={iconClass} />;
                                  default:
                                    return null;
                                }
                              };


                              // Get label based on category
                              const getLabel = () => {
                                return getCategoryLabel(
                                  category,
                                  category === 'registrar' ? (account as CloudflareAccount).registrarName : undefined
                                );
                              };

                              return (
                                <>
                                  {renderIcon()}
                                  {getLabel()}
                                </>
                              );
                            })()}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 group">
                          <span className="text-sm truncate max-w-[200px]" title={emailOrName}>
                            {emailOrName}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(emailOrName, `name-${accountId}`)}
                            title={isProxy ? "Copy name" : "Copy email"}
                          >
                            {copiedField === `name-${accountId}` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate max-w-[300px]">
                            {visibleTokens[accountId] ? apiToken : displayToken}
                          </code>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted"
                              onClick={() => toggleTokenVisibility(accountId)}
                              title={visibleTokens[accountId] ? "Hide credentials" : "Show credentials"}
                            >
                              {visibleTokens[accountId] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted"
                              onClick={() => copyToClipboard(apiToken, `credentials-${accountId}`)}
                              title={isProxy ? "Copy credentials" : "Copy token"}
                            >
                              {copiedField === `credentials-${accountId}` ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-muted"
                            onClick={() => onEditClick(account)}
                            title="Edit account"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDeleteClick(accountId)}
                            title="Delete account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
