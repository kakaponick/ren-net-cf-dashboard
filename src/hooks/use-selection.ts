import { useCallback, useMemo, useRef, useState } from 'react'

export interface UseSelectionApi<TId extends string | number> {
  isSelected: (id: TId) => boolean
  toggleOne: (id: TId) => void
  toggleAll: () => void
  clear: () => void
  allSelected: boolean
  selectedCount: number
}

/**
 * Optimized selection state for large lists.
 * Uses an inclusive/exclusive model to avoid creating massive Sets on "select all".
 *
 * - When selectAll is false, `explicit` holds selected ids.
 * - When selectAll is true, `explicit` holds deselected ids (exceptions).
 */
export function useSelection<TId extends string | number>(currentIds: readonly TId[]): UseSelectionApi<TId> {
  const [selectAll, setSelectAll] = useState(false)
  const [explicit, setExplicit] = useState<Set<TId>>(() => new Set())

  // Stabilize a Set for fast membership checks over the current ids
  const idsSet = useMemo(() => new Set(currentIds), [currentIds])

  // Track the length of currentIds without recomputing repeatedly
  const currentCountRef = useRef(0)
  if (currentCountRef.current !== currentIds.length) {
    currentCountRef.current = currentIds.length
  }

  const isSelected = useCallback(
    (id: TId) => (selectAll ? !explicit.has(id) : explicit.has(id)),
    [selectAll, explicit]
  )

  const toggleOne = useCallback(
    (id: TId) => {
      setExplicit(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    []
  )

  const toggleAll = useCallback(() => {
    // Flip the model and clear exceptions to make the operation O(1)
    setSelectAll(prev => !prev)
    setExplicit(new Set())
  }, [])

  const clear = useCallback(() => {
    setSelectAll(false)
    setExplicit(new Set())
  }, [])

  const selectedCount = useMemo(() => {
    if (!selectAll) {
      // Count only ids that are part of the current set
      let count = 0
      explicit.forEach(id => {
        if (idsSet.has(id)) count += 1
      })
      return count
    }
    // selectAll: selected = currentIds - exceptionsInCurrent
    let exceptionsInCurrent = 0
    explicit.forEach(id => {
      if (idsSet.has(id)) exceptionsInCurrent += 1
    })
    return currentIds.length - exceptionsInCurrent
  }, [selectAll, explicit, idsSet, currentIds])

  const allSelected = selectedCount > 0 && selectedCount === currentCountRef.current

  return {
    isSelected,
    toggleOne,
    toggleAll,
    clear,
    allSelected,
    selectedCount,
  }
}


