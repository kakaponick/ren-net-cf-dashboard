import type { CloudflareAccount, ProxyAccount, VPSAccount, SSHAccount, NPMAccount, AccountCategory, RegistrarType } from '@/types/cloudflare'

export interface CredentialParser<T> {
    category: AccountCategory
    parse: (line: string, extraOptions?: any) => Partial<T> | null
    export: (account: T) => string
    helpText: string
    exampleText: string
}

// --- Cloudflare Parser ---
export const CloudflareParser: CredentialParser<CloudflareAccount> = {
    category: 'cloudflare',
    parse: (line: string) => {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 2) return null

        // Basic validation
        const email = parts[0]
        const apiToken = parts[1]
        if (!email.includes('@') || !apiToken) return null

        return {
            email,
            apiToken,
            category: 'cloudflare'
        }
    },
    export: (account) => `${account.email}  ${account.apiToken}`,
    helpText: "Format: Email  API_Token",
    exampleText: `# Example format (one account per line):
user@company.com  auth_token_123abc
admin@client.com  auth_token_456def`
}

// --- Registrar Parser ---
export const RegistrarParser: CredentialParser<CloudflareAccount> = {
    category: 'registrar',
    parse: (line: string, options: { registrarName: RegistrarType }) => {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 2) return null

        const email = parts[0]
        const apiToken = parts[1]

        // Basic validation
        if (!email.includes('@') || !apiToken) return null

        const result: Partial<CloudflareAccount> = {
            email,
            apiToken,
            category: 'registrar',
            registrarName: options.registrarName,
            username: email.split('@')[0].replaceAll('.', '') // Default username from email
        }

        // Namecheap specific: Optional Proxy (3rd argument)
        if (options.registrarName === 'namecheap' && parts.length >= 3) {
            // We return the proxy string here, it needs to be processed by the hook/caller to find/create the proxy
            // This is a bit of a leaky abstraction but necessary since we can't search the store here easily without passing it in
            // A better approach might be to just return the data structure and let the hook handle the proxy lookup/creation
            // For now, we'll store the raw proxy string in a temporary field if needed, or rely on the hook to re-parse the line parts 
            // But to keep it clean, let's just return the core data and let the hook handle the proxy part if it detects it.
            // Actually, let's keep it simple: The parser returns valid account data. 
            // The hook is responsible for the complex "find or create proxy" logic using the raw line parts if needed.
            // Or we can parse the proxy string here and return it as a structured object
        }

        return result
    },
    export: (account) => `${account.email}  ${account.apiToken}`, // Proxies are linked via ID, not easily exported as string inline unless we fetching the proxy. The hook handles export logic more fully.
    helpText: "Format: Email  API_Key  [Proxy (Host:Port:User:Pass)]",
    exampleText: `# Example format (one account per line):
user@example.com  api_key_1234567890
admin@client.com  api_key_abcdef1234  127.0.0.1:1080
support@company.com  api_key_xyz789  192.168.1.1:1080:username:password`
}


// --- Proxy Parser ---
export const ProxyParser: CredentialParser<ProxyAccount> = {
    category: 'proxy',
    parse: (line: string) => {
        // Expected: host:port[:user:pass] OR host port user pass (space separated)
        // The previous implementation primarily supported colon separated for the single string
        // But the instructions said "Host:Port[:User:Pass]"

        // Try colon separation first as it's the standard proxy notation
        let parts = line.trim().split(':')

        // If only one part, maybe it's space separated?
        if (parts.length === 1) {
            parts = line.trim().split(/\s+/)
        }

        if (parts.length < 2) return null

        const host = parts[0]
        const port = parseInt(parts[1])

        if (!host || isNaN(port)) return null

        const username = parts[2] || undefined
        const password = parts[3] || undefined

        return {
            name: `Proxy ${host}:${port}`,
            host,
            port,
            username,
            password,
            category: 'proxy'
        }
    },
    export: (account) => {
        let base = `${account.host}:${account.port}`
        if (account.username) {
            base += `:${account.username}`
            if (account.password) {
                base += `:${account.password}`
            }
        }
        return base
    },
    helpText: "Format: Host:Port[:User:Pass]",
    exampleText: `# Example format (one proxy per line):
127.0.0.1:1080
127.0.0.1:1080:username:password
proxy.example.com:1080`
}

// --- VPS Parser ---
export const VPSParser: CredentialParser<VPSAccount> = {
    category: 'vps',
    parse: (line: string) => {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 2) return null

        const name = parts[0]
        const ip = parts[1]

        if (!name || !ip) return null

        return {
            name,
            ip,
            email: parts[2] || undefined,
            password: parts[3] || undefined,
            expirationDate: parts[4] || undefined,
            category: 'vps'
        }
    },
    export: (account) => {
        let line = `${account.name}  ${account.ip}`
        if (account.email) line += `  ${account.email}`
        if (account.password) line += `  ${account.password}`
        if (account.expirationDate) line += `  ${account.expirationDate}`
        return line
    },
    helpText: "Format: Name  IP  [Email]  [Password]  [ExpirationDate]",
    exampleText: `# Example format (one server per line):
Production-Server-1  192.168.1.1
Staging-Server  10.0.0.5  admin@vps.com  password123
Dev-Server  10.0.0.10  admin@dev.com  secret  31-12-2025`
}

// --- SSH Parser ---
export const SSHParser: CredentialParser<SSHAccount> = {
    category: 'ssh',
    parse: (line: string) => {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 3) return null

        // Name Host Port User (Key is hard to do bulk, usually assume Agent or standard location, or just basic auth via password)
        // Bulk importing SSH keys is messy. 
        // Let's assume for bulk: Name Host User [Port] [Pass/KeyPath?]

        // NOTE: The current UI doesn't explicitly support bulk SSH import in the original code. 
        // I will implement a basic version.

        const name = parts[0]
        const host = parts[1]
        const username = parts[2]
        const port = parseInt(parts[3] || "22")
        const passwordOrKey = parts[4] || ""

        if (!name || !host || !username) return null

        // Heuristic: if it looks like a path or begins with -----BEGIN, it's a key? 
        // For bulk import, simple password or just init structure is safer.

        return {
            name,
            host,
            username,
            port,
            privateKey: "", // User will likely need to add this manually or we treat the 4th arg as password?
            passphrase: "",
            category: 'ssh'
        }
    },
    export: (account) => `${account.name}  ${account.host}  ${account.username}  ${account.port}`,
    helpText: "Format: Name  Host  Username  [Port]",
    exampleText: `# Example format:
Prod-DB  10.0.0.2  root  22
Web-01   192.168.1.50  ubuntu`
}


// --- NPM Parser ---
export const NPMParser: CredentialParser<NPMAccount> = {
    category: 'npm',
    parse: (line: string) => {
        // NPM is complex (CloudflareAccount underneath). 
        // Format: Url Email Password [Name]
        const parts = line.trim().split(/\s+/)
        if (parts.length < 3) return null

        const host = parts[0]
        const email = parts[1] // Identity
        const password = parts[2] // Secret
        const name = parts[3] || `NPM ${host}`

        if (!host || !email || !password) return null

        return {
            // We return the fields needed to construct it.
            // The store expects CloudflareAccount structure with JSON encoded token.
            // The hook will handle the conversion.
            name,
            email, // Identity
            apiToken: JSON.stringify({ host, secret: password }),
            category: 'npm'
        } as any
    },
    export: (account) => {
        // Need to decode the token to get host/secret
        let host = ""
        let secret = ""
        try {
            const decoded = JSON.parse(account.apiToken)
            host = decoded.host
            secret = decoded.secret
        } catch (e) { }

        return `${host}  ${account.email}  ${secret}  ${account.name}`
    },
    helpText: "Format: Host_URL  Email  Password  [Name]",
    exampleText: `# Example format:
https://npm.example.com  admin@example.com  secret123  My-NPM`
}


export const PARSERS = {
    cloudflare: CloudflareParser,
    registrar: RegistrarParser,
    proxy: ProxyParser,
    vps: VPSParser,
    ssh: SSHParser,
    npm: NPMParser
}
