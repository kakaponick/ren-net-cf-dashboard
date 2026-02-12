import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/index.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { Navigation } from '@/components/navigation';
import { TaskOperationWindow } from '@/components/task-operation-window';

const geistSans = Geist({
	subsets: ['latin'],
	variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
	subsets: ['latin'],
	variable: '--font-geist-mono',
});

export const metadata: Metadata = {
	title: 'Cloudflare Dashboard',
	description: 'Manage your Cloudflare domains and DNS records',
	icons: {
		icon: '/favicon.svg',
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<Navigation>
						{children}
					</Navigation>
					<Toaster />
					<TaskOperationWindow />
				</ThemeProvider>
			</body>
		</html>
	);
}
