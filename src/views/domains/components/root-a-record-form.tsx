import { useRef, useEffect } from 'react';
import { CloudCheck, CloudOff, Check, Loader2 } from 'lucide-react';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';
import { VPSIPCombobox } from '@/components/vps-ip-combobox';
import { Button } from "@/components/ui/button";

interface RootARecordFormProps {
	ipAddress: string;
	proxied: boolean;
	isProcessing: boolean;
	onIPChange: (ip: string) => void;
	onProxiedChange: (proxied: boolean) => void;
	onSubmit: () => void;
	onCancel?: () => void;
	autoFocus?: boolean;
}

export function RootARecordForm({
	ipAddress,
	proxied,
	isProcessing,
	onIPChange,
	onProxiedChange,
	onSubmit,
	onCancel,
	autoFocus = false,
}: RootARecordFormProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus && inputRef.current) {
			setTimeout(() => {
				inputRef.current?.focus();
			}, 100);
		}
	}, [autoFocus]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !isProcessing) {
			onSubmit();
		} else if (e.key === 'Escape' && onCancel) {
			onCancel();
		}
	};

	return (
		<div className="flex items-center gap-2 w-full">
			<div className="flex-1 relative">
				<VPSIPCombobox
					value={ipAddress}
					onChange={onIPChange}
					disabled={isProcessing}
					placeholder="1.2.3.4"
					className="h-9 rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
				<div className="absolute top-0 right-0 h-full flex items-center bg-transparent pointer-events-none border border-l-0 rounded-r-md border-input"></div>
			</div>
			<div className="flex items-center border border-l-0 border-input rounded-r-md bg-background h-9 -ml-2 z-10">
				<Button
					variant="ghost"
					size="icon"
					className="rounded-none border-r"
					onClick={() => onProxiedChange(!proxied)}
					disabled={isProcessing}
					title={proxied ? 'Proxied - Click to set DNS Only' : 'DNS Only - Click to set Proxied'}
				>
					{proxied ? <CloudCheck className="h-3 w-3 text-green-500" /> : <CloudOff className="h-3 w-3 text-gray-500" />}
				</Button>

				<Button
					variant="ghost"
					size="icon"
					className="rounded-l-none"
					onClick={onSubmit}
					disabled={isProcessing || !ipAddress.trim()}
					title="Save A record"
				>
					{isProcessing ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						<Check className="h-3 w-3 text-green-600" />
					)}
				</Button>
			</div>
		</div>
	);
}

