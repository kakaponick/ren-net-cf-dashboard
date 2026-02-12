import * as React from "react"
import { Cloud, Globe, Server, Terminal, ArrowRightLeft } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { getCategoryColorClasses } from "@/lib/utils"
import { AccountCategory } from "@/types/cloudflare"

interface AccountCategorySelectProps {
    value: AccountCategory | undefined
    onValueChange: (value: AccountCategory) => void
    disabled?: boolean
    id?: string
    placeholder?: string
}

export function AccountCategorySelect({
    value,
    onValueChange,
    disabled,
    id,
    placeholder = "Select account type"
}: AccountCategorySelectProps) {
    return (
        <Select
            value={value}
            onValueChange={(val) => onValueChange(val as AccountCategory)}
            disabled={disabled}
        >
            <SelectTrigger id={id} className="transition-colors focus:ring-2">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="cloudflare">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <Cloud className={`h-4 w-4 ${getCategoryColorClasses('cloudflare').text}`} />
                        </Badge>
                        Cloudflare Account
                    </div>
                </SelectItem>
                <SelectItem value="registrar">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <Globe className={`h-4 w-4 ${getCategoryColorClasses('registrar').text}`} />
                        </Badge>
                        Domain Registrar
                    </div>
                </SelectItem>
                <SelectItem value="vps">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <Server className={`h-4 w-4 ${getCategoryColorClasses('vps').text}`} />
                        </Badge>
                        Server Registrars
                    </div>
                </SelectItem>
                <SelectItem value="proxy">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <Server className={`h-4 w-4 ${getCategoryColorClasses('proxy').text}`} />
                        </Badge>
                        SOCKS5 Proxy
                    </div>
                </SelectItem>
                <SelectItem value="ssh">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <Terminal className={`h-4 w-4 ${getCategoryColorClasses('ssh').text}`} />
                        </Badge>
                        SSH Server
                    </div>
                </SelectItem>
                <SelectItem value="npm">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            <ArrowRightLeft className={`h-4 w-4 ${getCategoryColorClasses('npm').text}`} />
                        </Badge>
                        Nginx PM
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    )
}
