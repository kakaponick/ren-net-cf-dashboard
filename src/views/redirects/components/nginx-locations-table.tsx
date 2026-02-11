'use client';

import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ParsedNginxLocation } from '@/types/npm';
import { ExternalLink, Trash2, Save, X, Edit, AlertTriangle, Search, Copy } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterCombobox } from '@/components/filter-combobox';
import { toast } from 'sonner';
import { extractURLParameters, matchesURLFilters } from '@/lib/url-utils';

interface NginxLocationsTableProps {
    locations: ParsedNginxLocation[];
    onUpdate?: (index: number, location: string, destination: string) => void;
    onDelete?: (index: number) => void;
    onDeleteMultiple?: (indices: number[]) => void;
}

interface EditingState {
    index: number;
    location: string;
    destination: string;
}

// Optimization: Extract Row Component to prevent re-renders of the entire list
const LocationRow = memo(function LocationRow({
    loc,
    originalIndex,
    isSelected,
    isEditing,
    editingState,
    onToggleSelection,
    onStartEditing,
    onCancelEditing,
    onSaveEditing,
    onDelete,
    onLocationChange,
    onDestinationChange
}: {
    loc: ParsedNginxLocation;
    originalIndex: number;
    isSelected: boolean;
    isEditing: boolean;
    editingState: EditingState | null;
    onToggleSelection: (index: number) => void;
    onStartEditing: (index: number, loc: ParsedNginxLocation) => void;
    onCancelEditing: () => void;
    onSaveEditing: () => void;
    onDelete: (index: number) => void;
    onLocationChange: (value: string) => void;
    onDestinationChange: (value: string) => void;
}) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onSaveEditing();
        } else if (e.key === 'Escape') {
            onCancelEditing();
        }
    };

    const hasChanges = () => {
        if (!editingState) return false;
        return editingState.location !== loc.location || editingState.destination !== loc.destination;
    };

    return (
        <TableRow
            className={loc.isDuplicate ? 'bg-destructive/5 border-l-4 border-l-destructive' : ''}
        >
            <TableCell>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(originalIndex)}
                />
            </TableCell>
            <TableCell className="font-mono text-sm">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 mr-2">
                        <Button
                            asChild
                            variant="ghost"
                            className="h-8 w-8"
                            title="Open in new tab"
                        >
                            <a
                                href={`https://${loc.sourceDomain}${isEditing && editingState ? editingState.location : loc.location}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="h-3 w-3 opacity-50" />
                            </a>
                        </Button>
                        <CopyButton
                            text={`https://${loc.sourceDomain}${isEditing && editingState ? editingState.location : loc.location}`}
                            successMessage="Copied URL to clipboard"
                            errorMessage="Failed to copy URL"
                            size="icon"
                            className="h-8 w-8"
                            title="Copy full URL"
                            copyIconClassName="h-4 w-4"
                            checkIconClassName="h-4 w-4"
                        />
                    </div>
                    {isEditing && editingState ? (
                        <Input
                            value={editingState.location}
                            onChange={(e) => onLocationChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="font-mono text-sm h-8"
                        />
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{loc.location}</span>
                            {loc.isDuplicate && (
                                <span title="Duplicate location path">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline">{loc.sourceDomain}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
                {isEditing && editingState ? (
                    <Input
                        value={editingState.destination}
                        onChange={(e) => onDestinationChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="font-mono text-xs h-8"
                    />
                ) : (
                    <span className="">{loc.destination}</span>
                )}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    {isEditing ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onSaveEditing}
                                title="Save changes"
                                disabled={!hasChanges()}
                            >
                                <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCancelEditing}
                                title="Cancel editing"
                            >
                                <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onStartEditing(originalIndex, loc)}
                                title="Edit location"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(originalIndex)}
                                title="Delete location"
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
});

export function NginxLocationsTable({ locations, onUpdate, onDelete, onDeleteMultiple }: NginxLocationsTableProps) {
    const [editingRow, setEditingRow] = useState<EditingState | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [urlParamFilters, setUrlParamFilters] = useState<Record<string, string>>({});

    // Ref for editingRow to allow stable callbacks
    const editingRowRef = useRef(editingRow);
    editingRowRef.current = editingRow;

    // Extract unique URL parameters from all destinations
    const urlParameters = useMemo(() => {
        const allUrls = locations.map(loc => loc.destination);
        return extractURLParameters(allUrls);
    }, [locations]);

    // Filter locations based on search and URL parameters
    const filteredLocations = useMemo(() => {
        return locations.filter((loc, index) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch =
                    loc.location.toLowerCase().includes(query) ||
                    loc.destination.toLowerCase().includes(query) ||
                    loc.sourceDomain.toLowerCase().includes(query);

                if (!matchesSearch) return false;
            }

            // URL parameter filters
            if (Object.keys(urlParamFilters).length > 0) {
                if (!matchesURLFilters(loc.destination, urlParamFilters)) {
                    return false;
                }
            }

            return true;
        });
    }, [locations, searchQuery, urlParamFilters]);

    // Map filtered locations back to original indices for edit/delete operations
    // Memoize to keep it stable across renders if filtering doesn't change
    const getOriginalIndex = useCallback((filteredIndex: number): number => {
        return locations.indexOf(filteredLocations[filteredIndex]);
    }, [locations, filteredLocations]);

    const handleURLParamFilterChange = (param: string, value: string) => {
        setUrlParamFilters(prev => {
            if (value === 'all') {
                const { [param]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [param]: value };
        });
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setUrlParamFilters({});
        setSelectedRows(new Set());
    };

    const copySelectedUrls = () => {
        const urls = Array.from(selectedRows)
            .map(index => {
                const loc = locations[index];
                return `https://${loc.sourceDomain}${loc.location}`;
            })
            .join('\n');

        navigator.clipboard.writeText(urls);
        toast.success(`Copied ${selectedRows.size} URLs to clipboard`, {
            description: `${selectedRows.size} full URLs copied`,
        });
    };

    // Stable handlers using useCallback
    const handleToggleSelection = useCallback((originalIndex: number) => {
        setSelectedRows(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(originalIndex)) {
                newSelected.delete(originalIndex);
            } else {
                newSelected.add(originalIndex);
            }
            return newSelected;
        });
    }, []);

    const handleStartEditing = useCallback((index: number, loc: ParsedNginxLocation) => {
        setEditingRow({
            index,
            location: loc.location,
            destination: loc.destination,
        });
    }, []);

    const handleCancelEditing = useCallback(() => {
        setEditingRow(null);
    }, []);

    const handleSaveEditing = useCallback(() => {
        const currentEditing = editingRowRef.current;
        if (currentEditing && onUpdate) {
            onUpdate(currentEditing.index, currentEditing.location, currentEditing.destination);
            setEditingRow(null);
            toast.success('Location updated successfully');
        }
    }, [onUpdate]);

    const handleLocationChange = useCallback((value: string) => {
        setEditingRow(prev => prev ? { ...prev, location: value } : null);
    }, []);

    const handleDestinationChange = useCallback((value: string) => {
        setEditingRow(prev => prev ? { ...prev, destination: value } : null);
    }, []);

    const handleDeleteClick = useCallback((index: number) => {
        if (onDelete) {
            onDelete(index);
            toast.success('Location deleted successfully');
        }
    }, [onDelete]);

    const toggleAllRows = () => {
        if (selectedRows.size === filteredLocations.length && filteredLocations.length > 0) {
            setSelectedRows(new Set());
        } else {
            const allIndices = filteredLocations.map((_, i) => getOriginalIndex(i));
            setSelectedRows(new Set(allIndices));
        }
    };


    const handleDeleteSelected = () => {
        if (!onDeleteMultiple) return;

        if (window.confirm(`Are you sure you want to delete ${selectedRows.size} selected locations?`)) {
            onDeleteMultiple(Array.from(selectedRows));
            setSelectedRows(new Set());
        }
    };

    return (
        <div className="space-y-3">
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by location, domain, or destination..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* URL Parameter Filters */}
                {urlParameters.map(param => (
                    <FilterCombobox
                        key={param.paramName}
                        value={urlParamFilters[param.paramName] || 'all'}
                        onValueChange={(value) => handleURLParamFilterChange(param.paramName, value)}
                        options={[
                            { value: 'all', label: `All ${param.paramName}` },
                            ...param.values.map(v => ({ value: v, label: v })),
                        ]}
                        placeholder={`Filter by ${param.paramName}`}
                        className="w-[180px]"
                    />
                ))}

                {/* Clear Filters Button */}
                {(searchQuery || Object.keys(urlParamFilters).length > 0) && (
                    <Button
                        onClick={clearAllFilters}
                        size="sm"
                        variant="ghost"
                    >
                        Clear Filters
                    </Button>
                )}
            </div>

            {/* Results Count */}
            {(searchQuery || Object.keys(urlParamFilters).length > 0) && (
                <div className="text-sm text-muted-foreground">
                    Showing {filteredLocations.length} of {locations.length} locations
                </div>
            )}

            {selectedRows.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md border">
                    <span className="text-sm font-medium">
                        {selectedRows.size} location{selectedRows.size !== 1 ? 's' : ''} selected
                    </span>
                    <Button
                        onClick={copySelectedUrls}
                        size="sm"
                        variant="default"
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All URLs
                    </Button>
                    {onDeleteMultiple && (
                        <Button
                            onClick={handleDeleteSelected}
                            size="sm"
                            variant="destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Selected
                        </Button>
                    )}
                    <Button
                        onClick={() => setSelectedRows(new Set())}
                        size="sm"
                        variant="ghost"
                    >
                        Clear Selection
                    </Button>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                                checked={selectedRows.size === filteredLocations.length && filteredLocations.length > 0}
                                onCheckedChange={toggleAllRows}
                            />
                        </TableHead>
                        <TableHead className="w-[280px]">Location</TableHead>
                        <TableHead className="w-[200px]">Source Domain</TableHead>
                        <TableHead>Destination URL</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredLocations.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                {locations.length === 0
                                    ? 'No location redirects found in nginx configuration'
                                    : 'No locations match your search criteria'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredLocations.map((loc, filteredIndex) => {
                            const originalIndex = getOriginalIndex(filteredIndex);
                            const isRowEditing = editingRow?.index === originalIndex;
                            return (
                                <LocationRow
                                    key={`${loc.sourceDomain}-${loc.location}-${originalIndex}`}
                                    loc={loc}
                                    originalIndex={originalIndex}
                                    isSelected={selectedRows.has(originalIndex)}
                                    isEditing={isRowEditing}
                                    editingState={isRowEditing ? editingRow : null}
                                    onToggleSelection={handleToggleSelection}
                                    onStartEditing={handleStartEditing}
                                    onCancelEditing={handleCancelEditing}
                                    onSaveEditing={handleSaveEditing}
                                    onDelete={handleDeleteClick}
                                    onLocationChange={handleLocationChange}
                                    onDestinationChange={handleDestinationChange}
                                />
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
