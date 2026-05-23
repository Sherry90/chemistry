// Phase 11 §6.2 — CompoundBrowser 모달 패널 (registerPanel.load default).
import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, selectCompoundSearch, useMoleculeStore, mapIngestErrorToKey } from '@/stores';
import type { Compound } from '@/chemistry/compounds/types';
import type { CompoundCategory } from '@/chemistry/compounds/categories';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';
import { SearchInput } from './SearchInput';
import { CategoryChips } from './CategoryChips';
import { ResultList, type ResultState } from './ResultList';
import { MoleculeCard } from '../_shared/MoleculeCard';
import { useDebouncedQuery } from './useDebouncedQuery';

export default function CompoundBrowserPanel(): React.ReactElement {
  const { t } = useTranslation('panels');
  const search = useUiStore(selectCompoundSearch);
  const setQuery = useUiStore((s) => s.actions.setCompoundSearchQuery);
  const setMode = useUiStore((s) => s.actions.setCompoundSearchMode);
  const runSearch = useUiStore((s) => s.actions.runCompoundSearch);
  const selectResult = useUiStore((s) => s.actions.selectCompoundSearchResult);
  const addFromCompound = useMoleculeStore((s) => s.actions.addFromCompound);
  const notify = useUiStore((s) => s.actions.notify);

  const [categories, setCategories] = useState<ReadonlyArray<CompoundCategory>>([]);
  const debouncedQuery = useDebouncedQuery({ value: search.query, delayMs: 300 });

  useEffect(() => {
    if (debouncedQuery.length === 0) return;
    // store 가 abort-replace 내부 처리 (uiStore 의도적 deviation — signal 미수용).
    void runSearch();
  }, [debouncedQuery, search.mode, runSearch]);

  const onAdd = async (cid: number): Promise<void> => {
    const result = await addFromCompound(cid);
    if (result.ok) {
      notify({
        level: 'success',
        messageKey: 'panels:compoundBrowser.addedToWorkspace',
        dismissAfterMs: 2000,
      });
      return;
    }
    // Phase 15 hotfix B — IngestError 를 지역화 키 + params 로 변환.
    // ToastItem 은 default ns 로 t() 호출 → 'common.X' → 'common:X' colon-form.
    const mapped = mapIngestErrorToKey(result.error);
    if (mapped.action === 'suppress') return; // 사용자 의도 (Aborted) — toast 발화 안 함.
    notify({
      level: 'error',
      messageKey: mapped.key.replace(/^common\./, 'common:'),
      ...(mapped.params ? { messageParams: mapped.params } : {}),
      dismissAfterMs: 5000,
    });
  };

  const onToggleCategory = (c: CompoundCategory): void =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const { state, compounds } = useMemo<{
    state: ResultState;
    compounds: ReadonlyArray<Compound>;
  }>(() => {
    const r = search.results;
    if (r.kind === 'idle') return { state: 'idle', compounds: [] };
    if (r.kind === 'loading') return { state: 'loading', compounds: [] };
    if (r.kind === 'error') return { state: 'error', compounds: [] };
    const filtered =
      categories.length === 0 ? r.value : r.value.filter((c) => categories.includes(c.category));
    return { state: 'success', compounds: filtered };
  }, [search.results, categories]);

  const selectedCompound =
    search.results.kind === 'success'
      ? (search.results.value.find((c) => c.cid === search.selectedCid) ?? null)
      : null;

  const errInfo =
    search.results.kind === 'error'
      ? { kind: search.results.error.kind, retryable: search.results.error.retryable }
      : { kind: undefined, retryable: undefined };

  return (
    <div className="flex h-[70vh] flex-col gap-4">
      <header className="flex items-center gap-4">
        <Tabs value={search.mode} onValueChange={(v) => setMode(v as 'name' | 'cid' | 'formula')}>
          <TabsList>
            <TabsTrigger value="name">{t('compoundBrowser.mode.name')}</TabsTrigger>
            <TabsTrigger value="cid">{t('compoundBrowser.mode.cid')}</TabsTrigger>
            <TabsTrigger value="formula">{t('compoundBrowser.mode.formula')}</TabsTrigger>
          </TabsList>
          {/* Phase 15 §6.4 retrofit — TabsTrigger aria-controls IDREF 가리킬 컨테이너 (axe). */}
          <TabsContent value="name" />
          <TabsContent value="cid" />
          <TabsContent value="formula" />
        </Tabs>
        <SearchInput value={search.query} onChange={setQuery} />
      </header>
      <CategoryChips selected={categories} onToggle={onToggleCategory} />
      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <div className="overflow-auto">
          <ResultList
            state={state}
            compounds={compounds}
            errorKind={errInfo.kind}
            retryable={errInfo.retryable}
            selectedCid={search.selectedCid}
            onSelect={selectResult}
            onRetry={() => void runSearch()}
          />
        </div>
        <div className="overflow-auto">
          {selectedCompound ? (
            <MoleculeCard
              compound={selectedCompound}
              actions={
                selectedCompound.cid != null
                  ? { onAddToWorkspace: () => void onAdd(selectedCompound.cid as number) }
                  : {}
              }
            />
          ) : (
            <p className="p-4 text-sm text-fg-muted">{t('compoundBrowser.empty.idle')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
