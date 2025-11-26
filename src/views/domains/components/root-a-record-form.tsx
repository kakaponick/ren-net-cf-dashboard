import { useRef, useEffect } from 'react';
import { CloudCheck, CloudOff, Check, Loader2 } from 'lucide-react';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';

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
		<InputGroup>
			<InputGroupInput
				ref={inputRef}
				placeholder="IP address"
				value={ipAddress}
				onChange={(e) => onIPChange(e.target.value)}
				onKeyDown={handleKeyDown}
				disabled={isProcessing}
			/>
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					variant="secondary"
					size="icon-xs"
					onClick={() => onProxiedChange(!proxied)}
					disabled={isProcessing}
					title={proxied ? 'Proxied - Click to set DNS Only' : 'DNS Only - Click to set Proxied'}
				>
					{proxied ? <CloudCheck className="h-3 w-3 text-green-500" /> : <CloudOff className="h-3 w-3 text-gray-500" />}
				</InputGroupButton>
				<InputGroupButton
					variant="secondary"
					size="icon-xs"
					onClick={onSubmit}
					disabled={isProcessing || !ipAddress.trim()}
					title="Save A record"
				>
					{isProcessing ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						<Check className="h-3 w-3 text-green-600" />
					)}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}

