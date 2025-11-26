import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import { cn } from '@/lib/utils';

type CopyButtonProps = Omit<ButtonProps, 'onClick' | 'children'> & {
	text: string;
	successMessage?: string;
	errorMessage?: string;
	showCheckIcon?: boolean;
	children?: React.ReactNode;
	copyIconClassName?: string;
	checkIconClassName?: string;
};

export function CopyButton({
	text,
	successMessage,
	errorMessage,
	showCheckIcon = true,
	children,
	variant = 'ghost',
	className,
	copyIconClassName,
	checkIconClassName,
	...props
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await copyToClipboard(
			text,
			successMessage || `Copied ${text} to clipboard`,
			errorMessage || 'Failed to copy to clipboard'
		);
		if (showCheckIcon) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<Button
			variant={variant}
			className={className}
			onClick={handleCopy}
			{...props}
		>
			{children}
			{showCheckIcon && copied ? (
				<Check className={cn('h-3 w-3 text-green-600', checkIconClassName)} />
			) : (
				<Copy className={cn('h-3 w-3 opacity-50', copyIconClassName)} />
			)}
		</Button>
	);
}

