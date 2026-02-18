import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export type ColumnVisibilityItem = {
	id: string;
	label: string;
	isVisible: boolean;
	onToggle: (isVisible: boolean) => void;
	disabled?: boolean;
};

export type PaginationToggle = {
	isEnabled: boolean;
	onToggle: (isEnabled: boolean) => void;
};

type ColumnVisibilityMenuProps = {
	items: ColumnVisibilityItem[];
	className?: string;
	paginationToggle?: PaginationToggle;
};

export function ColumnVisibilityMenu({
	items,
	className,
	paginationToggle
}: ColumnVisibilityMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className={cn("h-8 w-8 min-w-[32px] p-0", className)}
				>
					<Settings2 className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>Columns</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{items.map(({ id, label, isVisible, onToggle, disabled }) => (
					<DropdownMenuCheckboxItem
						key={id}
						className="capitalize"
						checked={isVisible}
						onCheckedChange={(value) => onToggle(Boolean(value))}
						onSelect={(event) => event.preventDefault()}
						disabled={disabled}
					>
						{label}
					</DropdownMenuCheckboxItem>
				))}
				{paginationToggle && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Settings</DropdownMenuLabel>
						<DropdownMenuCheckboxItem
							checked={paginationToggle.isEnabled}
							onCheckedChange={(value) => paginationToggle.onToggle(Boolean(value))}
							onSelect={(event) => event.preventDefault()}
						>
							Pagination
						</DropdownMenuCheckboxItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

