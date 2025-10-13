# Cloudflare Dashboard

A local React dashboard for managing multiple Cloudflare accounts, domains, DNS records, and SSL certificates.

## Features

- **Multi-Account Management**: Add and switch between multiple Cloudflare accounts
- **Domain Management**: View and manage all your Cloudflare zones/domains
- **DNS Records**: Full CRUD operations for DNS records with support for all record types
- **SSL Certificate Management**: View SSL certificates and manage SSL/TLS encryption modes
- **Local Storage**: All account data stored locally in your browser
- **Modern UI**: Built with React, TypeScript, Tailwind CSS, and Shadcn UI

## Getting Started

#### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Cloudflare API tokens for your accounts

#### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ren-net-cf-dashboard
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Start the development server:
```bash
pnpm dev
# or
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

### Adding Cloudflare Accounts

1. Go to the Accounts page
2. Click "Add Account"
3. Enter your account details:
   - Account Name: A friendly name for your account
   - Email: Your Cloudflare account email
   - API Token: Your Cloudflare API token

### Getting API Tokens

1. Log in to your Cloudflare dashboard
2. Go to "My Profile" → "API Tokens"
3. Click "Create Token"
4. Use "Custom token" template
5. Set permissions:
   - Zone:Zone:Read
   - Zone:DNS:Edit
   - Zone:SSL and Certificates:Read
6. Set Zone Resources to "Include - All zones" or specific zones
7. Create the token and copy it

### Managing Domains

1. Select an account from the sidebar
2. Go to the Domains page
3. View all your Cloudflare zones
4. Click "DNS" or "SSL" buttons to manage specific zones

### DNS Records Management

- View all DNS records for a zone
- Add new records with support for all record types (A, AAAA, CNAME, MX, TXT, etc.)
- Edit existing records
- Delete records with confirmation
- Toggle proxy status for applicable records

### SSL Certificate Management

- View SSL certificate status and details
- Manage SSL/TLS encryption modes (Off, Flexible, Full, Full Strict)
- View certificate validation records and errors
- Monitor certificate expiration dates

## Project Structure

```
src/
├── components/
│   ├── ui/                 # Shadcn UI components
│   ├── accounts/           # Account management components
│   ├── domains/            # Domain management components
│   ├── dns/                # DNS record components
│   └── ssl/                # SSL certificate components
├── lib/
│   ├── cloudflare-api.ts   # Cloudflare API client
│   ├── storage.ts          # Local storage utilities
│   └── utils.ts            # Utility functions
├── hooks/                  # Custom React hooks
├── types/
│   └── cloudflare.ts       # TypeScript type definitions
├── pages/                  # Page components
├── store/
│   └── account-store.ts    # Zustand store for account management
└── App.tsx                 # Main app component
```

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Shadcn UI** - Component library
- **Zustand** - State management
- **React Router** - Navigation
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **Cloudflare API** - Official Cloudflare SDK
- **Sonner** - Toast notifications
- **Lucide React** - Icons

## Security Notes

- API tokens are stored in browser localStorage
- No data is sent to external servers except Cloudflare API
- All account data remains local to your browser
- Consider using browser profiles for additional security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details