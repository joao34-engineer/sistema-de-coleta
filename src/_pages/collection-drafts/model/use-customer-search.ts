"use client";

import { useEffect, useRef, useState } from "react";

export const CUSTOMER_SEARCH_DEBOUNCE_MS = 300;
export const CUSTOMER_SEARCH_MIN_QUERY_LENGTH = 2;

type CustomerSearchResult<TCustomer> =
  | { ok: true; customers: readonly TCustomer[] }
  | { ok: false; error: string };

type Input<TCustomer> = Readonly<{
  query: string;
  online: boolean;
  search: (query: string) => Promise<CustomerSearchResult<TCustomer>>;
}>;

export function useCustomerSearch<TCustomer>({ query, online, search }: Input<TCustomer>): {
  results: readonly TCustomer[];
  isSearching: boolean;
} {
  const [fetchedResults, setFetchedResults] = useState<readonly TCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const generationRef = useRef(0);
  const trimmed = query.trim();
  const canSearch = online && trimmed.length >= CUSTOMER_SEARCH_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!canSearch) {
      generationRef.current += 1;
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const handle = window.setTimeout(() => {
      setIsSearching(true);
      void search(trimmed).then((result) => {
        if (generation !== generationRef.current) {
          return;
        }
        setIsSearching(false);
        if (result.ok) {
          setFetchedResults(result.customers);
        }
      });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
      generationRef.current += 1;
    };
  }, [canSearch, search, trimmed]);

  return {
    results: canSearch ? fetchedResults : [],
    isSearching: canSearch && isSearching,
  };
}
