/**
 * React Query hooks cho Firestore.
 *
 * Lợi ích so với fetch thủ công qua useEffect:
 * - Cache + dedupe: nhiều component fetch cùng collection chỉ gọi Firestore 1 lần
 * - Background revalidate: cache "stale" nhưng hiển thị ngay, refresh ngầm
 * - Optimistic update: cập nhật UI trước khi Firestore trả lời
 * - Tránh flash loading khi chuyển tab
 *
 * Convention: cache key là array `["collection", ...args]` để React Query
 * tự động dedupe và refetch theo dependency.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Fetch toàn bộ document trong 1 collection (có thể filter/sort).
 * Cache key: ["collection", collectionPath, ...filterKey]
 */
export function useCollection<T = DocumentData>(
  collectionPath: string | null | undefined,
  constraints: QueryConstraint[] = [],
  filterKey: string[] = []
) {
  return useQuery({
    queryKey: ["collection", collectionPath, ...filterKey, ...constraints.map(c => c.toString())],
    enabled: Boolean(collectionPath),
    placeholderData: keepPreviousData, // giữ data cũ khi refetch → không flash loading
    queryFn: async (): Promise<T[]> => {
      if (!collectionPath) return [];
      const q = query(collection(db, collectionPath), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
    },
  });
}

/**
 * Fetch 1 document theo path "collection/id".
 * Cache key: ["doc", path]
 */
export function useDoc<T = DocumentData>(
  docPath: string | null | undefined
) {
  return useQuery({
    queryKey: ["doc", docPath],
    enabled: Boolean(docPath),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<T | null> => {
      if (!docPath) return null;
      const snap = await getDoc(doc(db, docPath));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as unknown as T;
    },
  });
}

/**
 * Fetch 1 collection lồng trong 1 doc (VD: courses/{id}/lessons).
 * Cache key: ["subcollection", parentPath, subName, ...filterKey]
 */
export function useSubcollection<T = DocumentData>(
  parentPath: string | null | undefined,
  subName: string | null | undefined,
  constraints: QueryConstraint[] = [],
  filterKey: string[] = []
) {
  return useQuery({
    queryKey: ["subcollection", parentPath, subName, ...filterKey, ...constraints.map(c => c.toString())],
    enabled: Boolean(parentPath && subName),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<T[]> => {
      if (!parentPath || !subName) return [];
      const q = query(collection(db, parentPath, subName), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
    },
  });
}

/**
 * Helper invalidation: khi mutation xong, refetch tất cả query có key match.
 *
 *   const qc = useQueryClient();
 *   qc.invalidateCollection("users");
 */
export function useInvalidateCollection() {
  const qc = useQueryClient();
  return (path: string, exactFilterKey?: string[]) => {
    qc.invalidateQueries({
      queryKey: ["collection", path, ...(exactFilterKey ?? [])],
      exact: false,
    });
  };
}

/**
 * Mutation helper: chạy async fn, hiển thị loading/error, tự invalidate cache.
 *
 *   const update = useDocMutation({
 *     onMutate: async (vars) => { ... optimistic update ... },
 *     invalidate: ["users"],
 *   });
 */
export function useDocMutation<TVars, TResult = unknown>(opts: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  /** Cache key prefix cần invalidate sau khi mutation xong */
  invalidate?: (string | string[])[];
  /** Optimistic update trước khi mutation chạy */
  onMutate?: (vars: TVars) => void | Promise<void>;
  /** Side effect sau khi mutation thành công */
  onSuccess?: (data: TResult, vars: TVars) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: opts.mutationFn,
    onMutate: opts.onMutate,
    onSuccess: (data, vars) => {
      // Invalidate các collection liên quan
      if (opts.invalidate) {
        for (const key of opts.invalidate) {
          const keys = Array.isArray(key) ? key : [key];
          for (const k of keys) {
            qc.invalidateQueries({ queryKey: ["collection", k], exact: false });
            qc.invalidateQueries({ queryKey: ["subcollection"], exact: false });
          }
        }
      }
      opts.onSuccess?.(data, vars);
    },
  });
}

export { orderBy, where };